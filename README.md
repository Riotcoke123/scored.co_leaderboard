<!DOCTYPE html>
<html lang="en">
<head>

</head>
<body>
    <h1>🏆 scored.co Community Leaderboard</h1>
    <p class="repo-link">Repository: <a href="https://github.com/Riotcoke123/scored.co_leaderboard" target="_blank">Riotcoke123/scored.co_leaderboard</a></p>
    <h2>🔗 Project Links</h2>
    <ul>
        <li><strong>Website:</strong> <a href="https://scored.co/" target="_blank">https://scored.co/</a></li>
        <li><strong>API Documentation:</strong> <a href="https://docs.scored.co/" target="_blank">https://docs.scored.co/</a></li>
    </ul>
    <hr>
    <h2>✨ Overview</h2>
    <p>This Node.js/Express application acts as a real-time (updated every 15 minutes) leaderboard and historical tracking tool for user engagement across specified <code>scored.co</code> communities (currently **spictank** and **ip2always**).</p>
    <p>It periodically fetches new posts from the <code>scored.co</code> API, calculates a **cumulative total score** for each user based on their post upvotes (score is calculated as <code>post.score_up * 120</code>), and saves the historical data to a local <code>data.json</code> file.</p>
    <p>A simple API endpoint serves the current, sorted rankings from an in-memory cache for fast retrieval.</p>
    <hr>
    <h2>🛠️ Setup and Installation</h2>
    <h3>1. Prerequisites</h3>
    <ul>
        <li>Node.js (LTS recommended)</li>
        <li>npm or yarn</li>
    </ul>
    <h3>2. Installation</h3>
    <pre><code># Clone the repository
git clone https://github.com/Riotcoke123/scored.co_leaderboard.git
cd scored.co_leaderboard
# Install dependencies
npm install
# or yarn install</code></pre>
    <h3>3. Environment Variables</h3>
    <p>Create a <code>.env</code> file in the project root to store necessary API credentials and configuration. The application relies on the following variables for accessing the <code>scored.co</code> API:</p>
    <pre><code># Server Port (optional, defaults to 3000)
PORT=3000
# Scored.co API Credentials (REQUIRED)
API_ACCEPT="application/json"
API_USER_AGENT="Your-Application-Name"
API_REFERER="https://scored.co/"
API_KEY="YOUR_API_KEY_HERE"
API_SECRET="YOUR_API_SECRET_HERE"
API_PLATFORM="web"
API_XSRF_TOKEN="YOUR_XSRF_TOKEN_HERE"</code></pre>
    <p><strong>Note:</strong> You must obtain valid API credentials from scored.co to fetch data successfully.</p>
    <h3>4. Running the Server</h3>
    <pre><code># Start the server
node index.js
# or use a process manager like PM2 for production</code></pre>
    <p>The server will start at the specified port (e.g., <code>http://localhost:3000</code>). Upon startup, it immediately runs the first ranking update and then repeats the process every 15 minutes.</p>
    <hr>
    <h2>🚀 API Endpoint</h2>
    <p>The leaderboard data is exposed via a single, unauthenticated GET endpoint.</p>
    <h3>GET /rankings</h3>
    <p>Returns the currently cached, sorted leaderboard data. It updates every 15 minutes.</p>
    <pre><code>curl http://localhost:3000/rankings</code></pre>
    <h4>Example Response Structure:</h4>
    <pre><code>[
  {
    "rank": 1,
    "username": "User_A",
    "score": 15600,
    "profileLink": "https://scored.co/u/User_A",
    "lastActive": "3 minutes ago"
  },
  {
    "rank": 2,
    "username": "User_B",
    "score": 9840,
    "profileLink": "https://scored.co/u/User_B",
    "lastActive": "1 hour ago"
  },
  // ... more users
]</code></pre>
    <p>If the application is starting up or updating, it will return a <code>503 Service Unavailable</code> status with an error message.</p>
    <hr>
    <h2>💡 Core Logic Highlights</h2>
    <h3>Data Persistence</h3>
    <ul>
        <li>User scores and history are saved to <code>data.json</code> using the <code>writeUserData</code> and <code>readUserData</code> functions.</li>
        <li>This ensures that **total scores are cumulative** and persist across server restarts and update cycles.</li>
    </ul>
    <h3>Scoring Mechanism</h3>
    <ul>
        <li>The score for a user is calculated by aggregating the upvotes (<code>score_up</code>) from all new posts fetched in the current interval.</li>
        <li>The scoring formula is: $\text{Total Score} = \sum (\text{post.score\_up} \times 120)$.</li>
        <li>User data includes a <code>scoreHistory</code> array to track the cumulative score at each update interval.</li>
    </ul>
    <h3>Caching and Update Interval</h3>
    <ul>
        <li>The <code>updateRankings</code> function runs every **15 minutes** (<code>15 * 60 * 1000</code> ms).</li>
        <li>The sorted rankings are stored in the in-memory array <code>cachedRankings</code>.</li>
        <li>The <code>/rankings</code> endpoint serves data directly from this cache, providing a fast and efficient API response without hitting the file system for every request.</li>
    </ul>
    <hr>
    <h2>⚠️ Important Notes</h2>
    <ul>
        <li>**Error Handling:** Robust error handling is implemented for API calls (using <code>fetchCommunityData</code>) and file system operations (<code>readUserData</code>/<code>writeUserData</code>).</li>
        <li>**Dependency:** The application uses <code>axios</code> for API fetching, <code>dotenv</code> for configuration, and <code>cors</code> for enabling cross-origin requests to the <code>/rankings</code> endpoint.</li>
        <li>**Time Formatting:** The <code>formatTimeAgo</code> function intelligently converts Unix epoch timestamps into a human-readable "time ago" string (e.g., "5 minutes ago") for the <code>lastActive</code> field.</li>
    </ul>

</body>
</html>
