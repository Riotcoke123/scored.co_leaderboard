import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const filePath = path.join(__dirname, 'data.json');

// In-memory cache for fast API responses
let cachedRankings = [];

// --- File System Helpers ---

/**
 * Reads and parses the JSON data file.
 * @returns {object} The parsed user data or an empty object on failure.
 */
function readUserData() {
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }
    } catch (err) {
        console.error('❌ Error reading user data file, starting fresh:', err);
    }
    return {}; // Return empty object if file doesn't exist, is empty, or corrupt
}

/**
 * Writes user data to the JSON file.
 * @param {object} data - The user data to save.
 */
function writeUserData(data) {
    try {
        const directory = path.dirname(filePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('❌ Error saving user data to file:', err);
    }
}

// --- Time Formatting Helper ---
/**
 * Converts a Unix epoch timestamp into a human-readable "time ago" format.
 * @param {number} epoch - The Unix timestamp (in seconds or milliseconds).
 * @returns {string} Human-readable time difference.
 */
function formatTimeAgo(epoch) {
    // Some APIs return seconds, some return ms — normalize to ms
    if (epoch.toString().length === 10) {
        epoch = epoch * 1000;
    }

    const now = Date.now();
    const diffMs = now - epoch;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

// --- API Data Fetching ---
/**
 * Fetches new posts for a given community from the scored.co API.
 * @param {string} community - The name of the community to fetch posts from.
 * @returns {Promise<Array>} A promise that resolves to an array of post objects.
 */
async function fetchCommunityData(community) {
    try {
        const response = await axios.get(
            `https://scored.co/api/v2/post/newv2.json?community=${community}`, {
                headers: {
                    'accept': process.env.API_ACCEPT,
                    'user-agent': process.env.API_USER_AGENT,
                    'referer': process.env.API_REFERER,
                    'x-api-key': process.env.API_KEY,
                    'x-api-secret': process.env.API_SECRET,
                    'x-api-platform': process.env.API_PLATFORM,
                    'x-xsrf-token': process.env.API_XSRF_TOKEN
                }
            }
        );
        return response.data?.posts || [];
    } catch (error) {
        console.error(`❌ Error fetching data for ${community}:`, error.message);
        return [];
    }
}

// --- Ranking Logic ---
/**
 * Processes new posts, updates user scores, and maintains history.
 * @param {Array} posts - Array of new post objects.
 * @param {object} allUsersData - The existing user data object.
 * @returns {object} The updated user data object.
 */
function processPosts(posts, allUsersData) {
    const intervalUserScores = {};
    const timestamp = new Date().toISOString();

    // 1. Aggregate scores from the new posts for each user in this interval
    posts.forEach(post => {
        const username = post.author;
        const score = post.score_up * 120;

        if (intervalUserScores[username]) {
            intervalUserScores[username].score += score;
        } else {
            intervalUserScores[username] = {
                score,
                profileLink: `https://scored.co/u/${username}`,
                lastActive: formatTimeAgo(post.created) // 👈 Convert epoch to "time ago"
            };
        }
    });

    // 2. Merge interval scores into the main historical user data
    for (const username in intervalUserScores) {
        const intervalData = intervalUserScores[username];

        if (!allUsersData[username]) {
            allUsersData[username] = {
                username,
                profileLink: intervalData.profileLink,
                totalScore: 0,
                scoreHistory: [],
                lastActive: intervalData.lastActive
            };
        }

        allUsersData[username].totalScore += intervalData.score;
        allUsersData[username].scoreHistory.push({
            timestamp,
            score: allUsersData[username].totalScore
        });

        // Update last active every time new posts are found
        allUsersData[username].lastActive = intervalData.lastActive;
    }

    return allUsersData;
}

/**
 * The main orchestrator function to update rankings.
 * Fetches new data, processes it, saves it, and updates the in-memory cache.
 */
async function updateRankings() {
    console.log(`⏳ Starting ranking update at ${new Date().toLocaleTimeString()}`);
    try {
        // 1. Fetch new posts from all specified communities
        const communities = ['spictank', 'ip2always'];
        let allPosts = [];
        for (const community of communities) {
            const posts = await fetchCommunityData(community);
            allPosts = allPosts.concat(posts);
        }

        // 2. Load the existing user database from the file
        const allUsersData = readUserData();

        // 3. Process new posts and merge with existing data
        const updatedUsersData = processPosts(allPosts, allUsersData);

        // 4. Save the complete, updated user data back to the file
        writeUserData(updatedUsersData);

        // 5. Generate and cache the sorted rankings for the API endpoint
        const sortedRankings = Object.values(updatedUsersData)
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((user, index) => ({
                rank: index + 1,
                username: user.username,
                score: user.totalScore,
                profileLink: user.profileLink,
                lastActive: user.lastActive // 👈 include last active in response
            }));

        cachedRankings = sortedRankings;

        console.log(`✅ Rankings updated. Total users tracked: ${Object.keys(updatedUsersData).length}.`);
    } catch (error) {
        console.error('❌ A critical error occurred during the ranking update:', error);
    }
}

// --- Server and API Endpoints ---
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/rankings', (req, res) => {
    // Serve directly from the in-memory cache for speed
    if (cachedRankings.length === 0) {
        return res.status(503).json({
            error: 'Rankings are being generated. Please try again in a moment.'
        });
    }
    res.json(cachedRankings);
});

// --- Initialisation ---
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    // Run the update immediately on start, then set the interval
    updateRankings();
    setInterval(updateRankings, 15 * 60 * 1000); // 15 minutes
});
