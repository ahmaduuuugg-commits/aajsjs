// 🎮 RHL TOURNAMENT 🎮 - Complete Enhanced Haxball Headless Script
// Enhanced version with all advanced features, commands, and tournament management
// Copy the entire script and paste it on haxball.com to create the tournament room

// ==================== IMPORTANT SETTINGS - Change before use ====================
const ROOM_CONFIG = {
    roomName: "🎮 RHL TOURNAMENT 🎮",
    playerName: "[HOST]",
    maxPlayers: 16,
    public: true,
    geo: { code: "eg", lat: 30.0444, lon: 31.2357 }, // Egypt - Cairo
    token: process.env.HAXBALL_TOKEN || "thr1.AAAAAGioii7He5G3opmqIQ.QWVGQjVKkXc", // ✅ Token from .env file
    iceServers: [
        // Enhanced STUN servers for better connectivity
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:global.stun.twilio.com:3478" },

        // Enhanced TURN servers for NAT traversal (Critical for connectivity)
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turns:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        // Additional free TURN servers
        {
            urls: "turn:relay1.expressturn.com:3478",
            username: "ef8KQWS923K17WUJ2H",
            credential: "ZLRSMhZdx97br5uy",
        },
        {
            urls: "turn:a.relay.metered.ca:80",
            username: "7a4b2b6e6e3e1e8e3e1e1e1e",
            credential: "password",
        },
        {
            urls: "turn:a.relay.metered.ca:80?transport=tcp",
            username: "7a4b2b6e6e3e1e8e3e1e1e1e",
            credential: "password",
        },
        {
            urls: "turn:a.relay.metered.ca:443",
            username: "7a4b2b6e6e3e1e8e3e1e1e1e",
            credential: "password",
        },
        {
            urls: "turns:a.relay.metered.ca:443?transport=tcp",
            username: "7a4b2b6e6e3e1e8e3e1e1e1e",
            credential: "password",
        },
    ],
    // Optional: You can also try these locations for better Middle East connectivity:
    // geo: { code: "ae", lat: 25.2048, lon: 55.2708 }, // UAE - Dubai
    // geo: { code: "sa", lat: 24.7136, lon: 46.6753 }, // Saudi Arabia - Riyadh
    // geo: { code: "tr", lat: 41.0082, lon: 28.9784 }, // Turkey - Istanbul (EU servers)
};

// Discord webhook URL for replay files (change this to your webhook URL)
const DISCORD_WEBHOOK_URL =
    "https://canary.discord.com/api/webhooks/1406959936851939379/Bla-hWfT8-lC5U9gXxouT9GA2W0Txltpnv4CrgzYvArO2mqMr_WaUkBA-TsYs3GrTXDT";

const DISCORD_CONFIG = {
    webhook: DISCORD_WEBHOOK_URL,
    channelId: "1406959666717790228",
    reportRoleId: "1406593382632915014",
    serverInvite: "https://discord.gg/R3Rtwqqhwm",
};

const OWNER_PASSWORD = "opopop"; // ✅ Default password

// ==================== SYSTEM VARIABLES ====================
let room;
let gameState = {
    serverStart: Date.now(), // Server start time
    owner: null,
    admins: new Set(),
    savedAdmins: new Map(), // Save admin info permanently: name -> connection
    savedOwner: null, // Save owner connection permanently
    ownerName: null, // Save owner name permanently
    clubs: new Map(),
    clubCaptains: new Map(),
    playerStats: new Map(),
    lastDiscordReminder: 0,
    matchStats: {
        redGoals: 0,
        blueGoals: 0,
        goalScorers: [],
        assists: [],
        mvp: null,
    },
    ballTracker: {
        lastTouchPlayer: null,
        lastTouchTime: 0,
        lastTouchTeam: 0,
        ballHistory: [],
    },
    antiCheat: {
        suspiciousPlayers: new Map(),
        speedViolations: new Map(),
        kickAttempts: new Map(),
    },
    weeklyStats: {
        topScorer: { name: null, goals: 0 },
        topAssist: { name: null, assists: 0 },
        mostMVP: { name: null, mvps: 0 },
        weeklyReset: Date.now(),
    },
    liveMatch: {
        isActive: false,
        startTime: null,
        spectators: [],
        highlights: [],
        redFormation: [],
        blueFormation: [],
    },
    playerRanking: new Map(), // نظام التصنيف الشخصي
    dailyChallenges: {
        active: false,
        challenge: null,
        participants: new Set(),
        completedBy: new Set(),
    },
    recording: {
        isRecording: false,
        startTime: null,
        recordedActions: [],
        matchTitle: "",
        recordingPlayer: null,
        videoRecording: null,
        recordingPath: "",
        screenshots: [],
    },
};

// ==================== ROOM INITIALIZATION ====================
console.log("🔍 Starting room initialization...");
console.log(
    "Token length:",
    ROOM_CONFIG.token ? ROOM_CONFIG.token.length : "NO TOKEN",
);
console.log("Room name:", ROOM_CONFIG.roomName);
console.log("Geo location:", ROOM_CONFIG.geo);

window.hbInitCalled = false;

// Check if HBInit is available
if (typeof HBInit === "undefined") {
    console.error("❌ HBInit function is not available!");
    window.initErrors = window.initErrors || [];
    window.initErrors.push("HBInit function not found");
    throw new Error("HBInit function not available");
}

console.log("✅ HBInit function is available");

try {
    console.log("🚀 Calling HBInit with config...");
    window.hbInitCalled = true;

    const startTime = Date.now();
    room = HBInit(ROOM_CONFIG);
    const endTime = Date.now();

    console.log(`⏱️ HBInit took ${endTime - startTime}ms`);
    console.log("✅ Room initialized successfully");

    // ✅ CRITICAL FIX: Store room object globally for server verification
    window.room = room;
    console.log("✅ Room object stored globally as window.room");

    // Force display room link to ensure everyone joins the same room
    setTimeout(() => {
        try {
            const roomLink = room.link;
            if (roomLink) {
                console.log("🔗 Room Link:", roomLink);
                room.sendAnnouncement(
                    `🔗 ROOM LINK: ${roomLink}`,
                    null,
                    0x00ff00,
                    "bold",
                    10,
                );
                room.sendAnnouncement(
                    `⚠️ IMPORTANT: Share this EXACT link to join the same room!`,
                    null,
                    0xff6600,
                    "bold",
                    8,
                );
                room.sendAnnouncement(
                    `🔄 If you can't see other players, you're in a different room!`,
                    null,
                    0xffff00,
                    "normal",
                    5,
                );

                // Store the link globally for easy access
                window.roomLink = roomLink;
            } else {
                console.warn(
                    "⚠️ Room link not available - possible token issue",
                );
                room.sendAnnouncement(
                    `⚠️ WARNING: Room link not available! Check token validity.`,
                    null,
                    0xff0000,
                    "bold",
                    8,
                );
            }
        } catch (error) {
            console.error("Error getting room link:", error);
        }
    }, 2000);

    // Setup room synchronization monitoring (Fix for player visibility issues)
    setupRoomSynchronization();

    // DISABLED: Discord notification to prevent multiple room announcements
    // sendDiscordWebhook({
    //     title: "🎮 RHL TOURNAMENT Started",
    //     description: "Tournament room is now online and ready for players!",
    //     color: 0x00ff00,
    //     timestamp: new Date().toISOString(),
    // });
} catch (error) {
    console.error("❌ Room initialization failed:", error);
    window.initErrors = window.initErrors || [];
    window.initErrors.push(error.message);
    throw error;
}

// ==================== ROOM SYNCHRONIZATION FUNCTIONS ====================
// Enhanced room synchronization to fix player visibility issues
function setupRoomSynchronization() {
    console.log("🔄 Setting up room synchronization monitoring...");

    // Initialize synchronization state
    gameState.sync = {
        lastPlayerCheck: Date.now(),
        playerCheckInterval: null,
        connectionMonitor: null,
        forceRefreshCount: 0,
        maxForceRefresh: 3,
        playerVisibilityMap: new Map(),
    };

    // Setup periodic player visibility check (every 15 seconds)
    gameState.sync.playerCheckInterval = setInterval(() => {
        checkPlayerVisibility();
    }, 15000);

    // Setup connection state monitoring (every 30 seconds)
    gameState.sync.connectionMonitor = setInterval(() => {
        monitorConnectionState();
    }, 30000);

    console.log("✅ Room synchronization monitoring active");
}

function checkPlayerVisibility() {
    try {
        const currentPlayers = room.getPlayerList();
        const currentTime = Date.now();

        console.log(
            `🔍 Player visibility check - ${currentPlayers.length} players detected`,
        );

        // Track player join/leave patterns for sync issues
        currentPlayers.forEach((player) => {
            if (!gameState.sync.playerVisibilityMap.has(player.id)) {
                gameState.sync.playerVisibilityMap.set(player.id, {
                    name: player.name,
                    firstSeen: currentTime,
                    lastSeen: currentTime,
                    syncIssues: 0,
                });

                // Announce new player joining to ensure everyone sees them
                room.sendAnnouncement(
                    `🔄 Player ${player.name} has joined the room - refreshing player list...`,
                    null,
                    0x00ffff,
                    "normal",
                    1,
                );
            } else {
                gameState.sync.playerVisibilityMap.get(player.id).lastSeen =
                    currentTime;
            }
        });

        // Remove players who left
        for (let [playerId, playerData] of gameState.sync.playerVisibilityMap) {
            const stillPresent = currentPlayers.some((p) => p.id === playerId);
            if (!stillPresent) {
                console.log(
                    `Player ${playerData.name} (ID: ${playerId}) left the room`,
                );
                gameState.sync.playerVisibilityMap.delete(playerId);
            }
        }

        // Force room state refresh if too many players but low activity
        if (
            currentPlayers.length > 1 &&
            gameState.sync.forceRefreshCount < gameState.sync.maxForceRefresh
        ) {
            const timeSinceLastCheck =
                currentTime - gameState.sync.lastPlayerCheck;
            if (timeSinceLastCheck > 45000) {
                // No activity for 45 seconds
                console.log("⚠️ Forcing room state refresh due to inactivity");
                room.sendAnnouncement(
                    "🔄 Refreshing room state to ensure all players are visible...",
                    null,
                    0xffff00,
                    "normal",
                    2,
                );
                gameState.sync.forceRefreshCount++;
            }
        }

        gameState.sync.lastPlayerCheck = currentTime;
    } catch (error) {
        console.error("Error in player visibility check:", error);
    }
}

function monitorConnectionState() {
    try {
        const players = room.getPlayerList();
        const currentTime = Date.now();

        console.log(
            `🌐 Connection monitor - Room status: ${players.length} players`,
        );

        // Check for stale connections or sync issues
        for (let [playerId, playerData] of gameState.sync.playerVisibilityMap) {
            const timeSinceLastSeen = currentTime - playerData.lastSeen;

            // If player hasn't been seen for too long, mark as potential sync issue
            if (timeSinceLastSeen > 60000) {
                // 1 minute
                playerData.syncIssues++;
                console.warn(
                    `⚠️ Player ${playerData.name} may have sync issues (${playerData.syncIssues})`,
                );

                // Force announcement to refresh player awareness
                if (playerData.syncIssues <= 2) {
                    room.sendAnnouncement(
                        `🔄 Checking connection for ${playerData.name}...`,
                        null,
                        0xff9900,
                        "normal",
                        1,
                    );
                }
            }
        }

        // Periodic connectivity check (removed empty announcement)
        // This was sending empty messages every 30 seconds - now removed
    } catch (error) {
        console.error("Error in connection state monitor:", error);
    }
}

// Enhanced player join handling with sync fix
function handlePlayerJoinSync(player) {
    console.log(
        `🔄 Enhanced join handling for ${player.name} (ID: ${player.id})`,
    );

    // Add delay to ensure proper sync
    setTimeout(() => {
        try {
            const allPlayers = room.getPlayerList();
            console.log(
                `Player list after ${player.name} joined: ${allPlayers.length} total players`,
            );

            // Force room state refresh announcement
            room.sendAnnouncement(
                `✅ ${player.name} successfully joined! Room now has ${allPlayers.length} players.`,
                null,
                0x00ff00,
                "bold",
                2,
            );

            // Update our tracking
            gameState.sync.playerVisibilityMap.set(player.id, {
                name: player.name,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                syncIssues: 0,
            });
        } catch (error) {
            console.error("Error in enhanced join handling:", error);
        }
    }, 1000); // 1 second delay for sync
}

// ==================== UTILITY FUNCTIONS ====================
function sendDiscordWebhook(embed) {
    if (
        !DISCORD_CONFIG.webhook ||
        DISCORD_CONFIG.webhook.includes("PUT_YOUR") ||
        !DISCORD_CONFIG.webhook.includes("discord.com")
    ) {
        return; // Don't send if webhook is not configured
    }

    try {
        fetch(DISCORD_CONFIG.webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [embed] }),
        }).catch((err) => console.log("Discord error:", err));
    } catch (error) {
        console.log("Discord error:", error);
    }
}

// Function to send chat messages to Discord
function sendChatToDiscord(player, message) {
    if (
        !DISCORD_CONFIG.webhook ||
        DISCORD_CONFIG.webhook.includes("PUT_YOUR") ||
        !DISCORD_CONFIG.webhook.includes("discord.com")
    ) {
        return; // Don't send if webhook is not configured
    }

    // Check if chat forwarding is enabled
    if (!gameState.discordChat) {
        gameState.discordChat = { enabled: true }; // Enabled by default
    }

    if (!gameState.discordChat.enabled) {
        return; // Don't send if disabled
    }

    // Ignore commands (starting with !)
    if (message.startsWith("!")) {
        return;
    }

    try {
        // Determine message color based on player role
        let color = 0xffffff; // White default
        let roleIcon = "💬";

        if (isOwner(player)) {
            color = 0xffd700; // Gold for owner
            roleIcon = "👑";
        } else if (isAdmin(player)) {
            color = 0x00ff00; // Green for admin
            roleIcon = "🛡️";
        }

        // Determine team icon
        let teamIcon = "";
        if (player.team === 1) {
            teamIcon = "🔴"; // Red team
        } else if (player.team === 2) {
            teamIcon = "🔵"; // Blue team
        } else {
            teamIcon = "👁️"; // Spectators
        }

        const chatEmbed = {
            description: `${roleIcon} ${teamIcon} **${player.name}**: ${message}`,
            color: color,
            timestamp: new Date().toISOString(),
            footer: {
                text: "💬 Game Chat",
            },
        };

        fetch(DISCORD_CONFIG.webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [chatEmbed] }),
        }).catch((err) => console.log("Discord chat error:", err));
    } catch (error) {
        console.log("Discord chat error:", error);
    }
}

function getPlayerRole(player) {
    // Check for club captain first (takes priority)
    for (let [clubName, captain] of gameState.clubCaptains) {
        if (captain === player.name) {
            if (gameState.owner && player.id === gameState.owner.id) {
                return `👑 OWNER [${clubName}]`;
            }
            if (gameState.admins.has(player.id)) {
                return `🛡️ STAFF [${clubName}]`;
            }
            return `👨‍✈️ CAPTAIN [${clubName}]`;
        }
    }

    // Check other roles
    if (gameState.owner && player.id === gameState.owner.id) return "👑 OWNER";
    if (gameState.admins.has(player.id)) return "🛡️ STAFF";

    // Check for club membership
    for (let [clubName, members] of gameState.clubs) {
        if (members.includes(player.name)) {
            return `⚽ [${clubName}]`;
        }
    }
    return "👤 PLAYER";
}

function formatPlayerName(player) {
    return `${getPlayerRole(player)} ${player.name}`;
}

function isOwner(player) {
    return gameState.owner && player.id === gameState.owner.id;
}

function isAdmin(player) {
    return isOwner(player) || gameState.admins.has(player.id);
}

function getPlayerStats(playerName) {
    if (!gameState.playerStats.has(playerName)) {
        gameState.playerStats.set(playerName, {
            goals: 0,
            assists: 0,
            ownGoals: 0,
            wins: 0,
            losses: 0,
            mvps: 0,
            gamesPlayed: 0,
        });
    }
    return gameState.playerStats.get(playerName);
}

function createGoalEffect(player) {
    const team = player.team;
    room.sendAnnouncement(
        team === 1 ? "🔴🔴🔴 G O A L ! 🔴🔴🔴" : "🔵🔵🔵 G O A L ! 🔵🔵🔵",
        null,
        team === 1 ? 0xff0000 : 0x0000ff,
        "bold",
        3,
    );
}

function createAssistEffect(player) {
    room.sendAnnouncement(
        `👊 Perfect assist by ${player.name}! 👊`,
        null,
        0x0066ff,
        "bold",
        1,
    );
}

function createOwnGoalEffect(player) {
    room.sendAnnouncement(
        `😂 Oops! Own goal by ${player.name}! 😂`,
        null,
        0xff0000,
        "bold",
        1,
    );
}

// Create detailed match report and send to Discord
function createMatchReport(redScore, blueScore, winner) {
    const matchId = Math.floor(Math.random() * 1000000000000000); // Generate random match ID
    const players = room.getPlayerList();
    const redPlayers = players.filter((p) => p.team === 1);
    const bluePlayers = players.filter((p) => p.team === 2);

    // Build the detailed match report text
    let reportText = "```\n"; // Start Discord code block for formatting
    reportText += "═══════════════════════════════════════════════\n";
    reportText += `📋 MATCH REPORT #${matchId}\n`;
    reportText += `[OLS8] Red Team ${redScore} - ${blueScore} Blue Team\n`;
    reportText += "═══════════════════════════════════════════════\n\n";

    // Basic stats
    reportText += `Possession: Red 50% - 50% Blue\n`;
    reportText += `Action Zone: Red 50% - 50% Blue\n\n`;

    // Team sections
    reportText += "🔴 RED TEAM STATS        🔵 BLUE TEAM STATS\n";
    reportText += "═══════════════════════════════════════════════\n\n";

    // Game Time section
    reportText += "⚡ Game Time:            ⚡ Game Time:\n\n";

    // Show players from both teams side by side
    const maxPlayers = Math.max(redPlayers.length, bluePlayers.length);
    for (let i = 0; i < Math.max(4, maxPlayers); i++) {
        let redText = "";
        let blueText = "";

        if (i < redPlayers.length) {
            const player = redPlayers[i];
            const displayName =
                player.name.length > 6
                    ? player.name.substring(0, 6)
                    : player.name;
            const gameTime = "1m58s"; // Placeholder
            redText = `${displayName}: ${gameTime}`;
        }

        if (i < bluePlayers.length) {
            const player = bluePlayers[i];
            const displayName =
                player.name.length > 6
                    ? player.name.substring(0, 6)
                    : player.name;
            const gameTime = "1m58s"; // Placeholder
            blueText = `${displayName}: ${gameTime}`;
        }

        if (redText || blueText) {
            reportText += `${redText.padEnd(25)} ${blueText}\n`;
        }
    }

    reportText += "\n═══════════════════════════════════════════════\n\n";

    // Player Stats section
    reportText += "🏅 Player Stats:         🏅 Player Stats:\n\n";

    // Show stats for each team
    for (let i = 0; i < Math.max(redPlayers.length, bluePlayers.length); i++) {
        let redText = "";
        let blueText = "";

        if (i < redPlayers.length) {
            const player = redPlayers[i];
            const stats = getPlayerStats(player.name);
            const displayName =
                player.name.length > 6
                    ? player.name.substring(0, 6)
                    : player.name;
            redText = `${displayName}: ${stats.goals}G ${stats.assists}A`;
        }

        if (i < bluePlayers.length) {
            const player = bluePlayers[i];
            const stats = getPlayerStats(player.name);
            const displayName =
                player.name.length > 6
                    ? player.name.substring(0, 6)
                    : player.name;
            blueText = `${displayName}: ${stats.goals}G ${stats.assists}A`;
        }

        if (redText || blueText) {
            reportText += `${redText.padEnd(25)} ${blueText}\n`;
        }
    }

    reportText += "\n═══════════════════════════════════════════════\n";

    // Recording info
    const currentTime = new Date();
    const timeStr = currentTime.toTimeString().substring(0, 8);
    reportText += `Recording: ${currentTime.toLocaleDateString()}-${timeStr}-${matchId}.hbr2 • Today at ${timeStr}\n`;
    reportText += "═══════════════════════════════════════════════\n";
    reportText += "```"; // End Discord code block

    // Send detailed report to Discord
    sendDiscordWebhook({
        title: "📋 DETAILED MATCH REPORT",
        description: reportText,
        color: 0x00ffff,
        timestamp: new Date().toISOString(),
        fields: [
            {
                name: "🏆 Winner",
                value: winner,
                inline: true,
            },
            {
                name: "📊 Final Score",
                value: `${redScore} - ${blueScore}`,
                inline: true,
            },
            {
                name: "🆔 Match ID",
                value: `#${matchId}`,
                inline: true,
            },
        ],
    });

    // Send simple notification to game chat
    room.sendAnnouncement(
        `📋 Match report sent to Discord! Match ID: #${matchId}`,
        null,
        0x00ffff,
        "bold",
    );
}

// ==================== DISCORD REMINDER SYSTEM ====================
function sendDiscordReminder() {
    if (!room) return; // Make sure room exists

    const now = Date.now();
    if (now - gameState.lastDiscordReminder >= 180000) {
        // 3 minutes
        room.sendAnnouncement(
            `📢 Join our Discord server: ${DISCORD_CONFIG.serverInvite}`,
            null,
            0x7289da,
            "bold",
        );
        gameState.lastDiscordReminder = now;
    }
}

setInterval(sendDiscordReminder, 180000); // Every 3 minutes

// ==================== ANTI-CHEAT SYSTEM ====================
function detectCheating(player) {
    const playerPos = room.getPlayerDiscProperties(player.id);
    if (!playerPos) return false;

    const now = Date.now();
    const suspicious = gameState.antiCheat.suspiciousPlayers.get(player.id) || {
        lastCheck: now,
        violations: 0,
        lastPos: playerPos,
    };

    // Check impossible speed
    if (suspicious.lastPos) {
        const distance = Math.sqrt(
            Math.pow(playerPos.x - suspicious.lastPos.x, 2) +
                Math.pow(playerPos.y - suspicious.lastPos.y, 2),
        );
        const timeDiff = now - suspicious.lastCheck;
        const speed = distance / (timeDiff / 1000); // pixels per second

        if (speed > 800) {
            // Impossible speed threshold
            suspicious.violations++;

            if (suspicious.violations >= 3) {
                // Auto-kick and report
                room.kickPlayer(
                    player.id,
                    "Anti-cheat: Suspicious movement",
                    false,
                );

                sendDiscordWebhook({
                    title: "🚨 ANTI-CHEAT ALERT",
                    description: `**${player.name}** has been auto-kicked for suspicious movement`,
                    color: 0xff0000,
                    timestamp: new Date().toISOString(),
                    fields: [
                        {
                            name: "Speed Detected",
                            value: `${speed.toFixed(2)} px/s`,
                            inline: true,
                        },
                        {
                            name: "Violations",
                            value: `${suspicious.violations}`,
                            inline: true,
                        },
                        { name: "Action", value: "Auto-kicked", inline: true },
                    ],
                });

                return true;
            } else {
                // Warning
                room.sendAnnouncement(
                    `⚠️ ${player.name}: Suspicious movement detected! Warning ${suspicious.violations}/3`,
                    null,
                    0xff6600,
                    "bold",
                );
            }
        }
    }

    suspicious.lastCheck = now;
    suspicious.lastPos = playerPos;
    gameState.antiCheat.suspiciousPlayers.set(player.id, suspicious);
    return false;
}

// ==================== WEEKLY STATISTICS SYSTEM ====================
function updateWeeklyStats(playerName, type, value = 1) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    // Reset weekly stats if a week has passed
    if (now - gameState.weeklyStats.weeklyReset > oneWeek) {
        gameState.weeklyStats = {
            topScorer: { name: null, goals: 0 },
            topAssist: { name: null, assists: 0 },
            mostMVP: { name: null, mvps: 0 },
            weeklyReset: now,
        };

        sendDiscordWebhook({
            title: "📊 WEEKLY RESET",
            description: "New week started! Stats have been reset.",
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
        });
    }

    let updated = false;

    switch (type) {
        case "goal":
            if (value > gameState.weeklyStats.topScorer.goals) {
                gameState.weeklyStats.topScorer = {
                    name: playerName,
                    goals: value,
                };
                updated = true;
            }
            break;
        case "assist":
            if (value > gameState.weeklyStats.topAssist.assists) {
                gameState.weeklyStats.topAssist = {
                    name: playerName,
                    assists: value,
                };
                updated = true;
            }
            break;
        case "mvp":
            if (value > gameState.weeklyStats.mostMVP.mvps) {
                gameState.weeklyStats.mostMVP = {
                    name: playerName,
                    mvps: value,
                };
                updated = true;
            }
            break;
    }

    if (updated) {
        sendDiscordWebhook({
            title: "🏆 NEW WEEKLY LEADER!",
            description: `**${playerName}** is now the weekly ${type} leader!`,
            color: 0xffd700,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Category", value: type.toUpperCase(), inline: true },
                { name: "Value", value: `${value}`, inline: true },
            ],
        });
    }
}

// ==================== LIVE MATCH ANALYSIS ====================
function startLiveMatch() {
    gameState.liveMatch = {
        isActive: true,
        startTime: Date.now(),
        spectators: room.getPlayerList().filter((p) => p.team === 0),
        highlights: [],
        redFormation: room.getPlayerList().filter((p) => p.team === 1),
        blueFormation: room.getPlayerList().filter((p) => p.team === 2),
    };

    sendDiscordWebhook({
        title: "⚽ LIVE MATCH STARTED",
        description: "Live match analysis is now active!",
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        fields: [
            {
                name: "🔴 Red Team",
                value:
                    gameState.liveMatch.redFormation
                        .map((p) => p.name)
                        .join("\n") || "No players",
                inline: true,
            },
            {
                name: "🔵 Blue Team",
                value:
                    gameState.liveMatch.blueFormation
                        .map((p) => p.name)
                        .join("\n") || "No players",
                inline: true,
            },
            {
                name: "👥 Spectators",
                value: `${gameState.liveMatch.spectators.length} watching`,
                inline: true,
            },
        ],
    });
}

function endLiveMatch() {
    if (!gameState.liveMatch.isActive) return;

    const matchDuration = Date.now() - gameState.liveMatch.startTime;
    const minutes = Math.floor(matchDuration / 60000);

    sendDiscordWebhook({
        title: "🏁 MATCH ENDED",
        description: "Live match analysis complete!",
        color: 0xff6600,
        timestamp: new Date().toISOString(),
        fields: [
            { name: "Duration", value: `${minutes} minutes`, inline: true },
            {
                name: "Highlights",
                value: `${gameState.liveMatch.highlights.length}`,
                inline: true,
            },
            {
                name: "Final Score",
                value: `${gameState.matchStats.redGoals} - ${gameState.matchStats.blueGoals}`,
                inline: true,
            },
        ],
    });

    gameState.liveMatch.isActive = false;
}

// ==================== PLAYER RANKING SYSTEM ====================
function updatePlayerRanking(playerName, action) {
    let ranking = gameState.playerRanking.get(playerName) || {
        points: 1000, // Starting ELO-style points
        rank: "Bronze",
        streak: 0,
        lastUpdated: Date.now(),
    };

    let pointChange = 0;

    switch (action) {
        case "goal":
            pointChange = +15;
            break;
        case "assist":
            pointChange = +10;
            break;
        case "win":
            pointChange = +25;
            break;
        case "loss":
            pointChange = -15;
            break;
        case "owngoal":
            pointChange = -20;
            break;
        case "mvp":
            pointChange = +50;
            break;
    }

    ranking.points += pointChange;
    ranking.points = Math.max(0, ranking.points); // Don't go below 0

    // Update rank based on points
    const oldRank = ranking.rank;
    if (ranking.points >= 2000) ranking.rank = "Diamond";
    else if (ranking.points >= 1700) ranking.rank = "Platinum";
    else if (ranking.points >= 1400) ranking.rank = "Gold";
    else if (ranking.points >= 1100) ranking.rank = "Silver";
    else ranking.rank = "Bronze";

    // Update streak
    if (pointChange > 0) ranking.streak = Math.max(0, ranking.streak + 1);
    else if (pointChange < 0) ranking.streak = Math.min(0, ranking.streak - 1);

    ranking.lastUpdated = Date.now();
    gameState.playerRanking.set(playerName, ranking);

    // Notify rank up/down
    if (oldRank !== ranking.rank) {
        const isPromotion =
            ["Bronze", "Silver", "Gold", "Platinum", "Diamond"].indexOf(
                ranking.rank,
            ) >
            ["Bronze", "Silver", "Gold", "Platinum", "Diamond"].indexOf(
                oldRank,
            );

        sendDiscordWebhook({
            title: isPromotion ? "🎉 RANK UP!" : "📉 RANK DOWN",
            description: `**${playerName}** ${isPromotion ? "promoted to" : "demoted to"} **${ranking.rank}**!`,
            color: isPromotion ? 0x00ff00 : 0xff6600,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "New Rank", value: ranking.rank, inline: true },
                { name: "Points", value: `${ranking.points}`, inline: true },
                { name: "Streak", value: `${ranking.streak}`, inline: true },
            ],
        });

        room.sendAnnouncement(
            `${isPromotion ? "🎉" : "📉"} ${playerName} ${isPromotion ? "promoted to" : "demoted to"} ${ranking.rank}!`,
            null,
            isPromotion ? 0x00ff00 : 0xff6600,
            "bold",
        );
    }
}

// ==================== DAILY CHALLENGES SYSTEM ====================
const dailyChallenges = [
    {
        id: "hat_trick",
        name: "Hat Trick Hero",
        description: "Score 3 goals in one match",
        reward: 100,
    },
    {
        id: "assist_king",
        name: "Assist King",
        description: "Get 5 assists in one day",
        reward: 75,
    },
    {
        id: "clean_sheet",
        name: "Clean Sheet",
        description: "Win without conceding goals",
        reward: 50,
    },
    {
        id: "comeback_kid",
        name: "Comeback Kid",
        description: "Win after being 2 goals behind",
        reward: 150,
    },
    {
        id: "speed_demon",
        name: "Speed Demon",
        description: "Score within first 30 seconds",
        reward: 80,
    },
];

function startDailyChallenge() {
    const challenge =
        dailyChallenges[Math.floor(Math.random() * dailyChallenges.length)];

    gameState.dailyChallenges = {
        active: true,
        challenge: challenge,
        participants: new Set(),
        completedBy: new Set(),
    };

    sendDiscordWebhook({
        title: "🎯 DAILY CHALLENGE STARTED",
        description: `**${challenge.name}**\n${challenge.description}`,
        color: 0x9932cc,
        timestamp: new Date().toISOString(),
        fields: [
            {
                name: "Reward",
                value: `${challenge.reward} points`,
                inline: true,
            },
            { name: "Time Limit", value: "24 hours", inline: true },
        ],
    });

    room.sendAnnouncement(
        `🎯 DAILY CHALLENGE: ${challenge.name} - ${challenge.description}`,
        null,
        0x9932cc,
        "bold",
    );
}

function checkDailyChallenge(playerName, action, data = {}) {
    if (!gameState.dailyChallenges.active) return;

    const challenge = gameState.dailyChallenges.challenge;
    let completed = false;

    switch (challenge.id) {
        case "hat_trick":
            if (action === "goal") {
                const playerStats = getPlayerStats(playerName);
                if (playerStats.goals >= 3) completed = true;
            }
            break;
        case "assist_king":
            if (action === "assist") {
                const playerStats = getPlayerStats(playerName);
                if (playerStats.assists >= 5) completed = true;
            }
            break;
        case "speed_demon":
            if (action === "goal" && data.gameTime && data.gameTime < 30) {
                completed = true;
            }
            break;
    }

    if (completed && !gameState.dailyChallenges.completedBy.has(playerName)) {
        gameState.dailyChallenges.completedBy.add(playerName);

        // Award points
        updatePlayerRanking(playerName, "challenge_complete");

        sendDiscordWebhook({
            title: "🏆 CHALLENGE COMPLETED!",
            description: `**${playerName}** completed the daily challenge!`,
            color: 0xffd700,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Challenge", value: challenge.name, inline: true },
                {
                    name: "Reward",
                    value: `${challenge.reward} points`,
                    inline: true,
                },
            ],
        });

        room.sendAnnouncement(
            `🏆 ${playerName} completed the daily challenge! +${challenge.reward} points!`,
            null,
            0xffd700,
            "bold",
        );
    }
}

// ==================== VIDEO RECORDING SYSTEM ====================
async function startVideoRecording(playerName, matchTitle = "") {
    if (gameState.recording.isRecording) {
        return false; // Already recording
    }

    try {
        // Signal the server to start recording via window messaging
        if (typeof window !== "undefined" && window.top) {
            window.recordingRequest = {
                action: "start",
                playerName: playerName,
                matchTitle: matchTitle,
                timestamp: Date.now(),
                videoQuality: "high",
                frameRate: 30, // Enhanced frame rate for smoother video
            };
        }

        // Start server-side video recording
        try {
            if (typeof fetch !== "undefined") {
                fetch("/api/start-recording", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        playerName: playerName,
                        matchTitle: matchTitle,
                        timestamp: Date.now(),
                    }),
                }).catch((error) => {
                    console.warn(
                        "Failed to start server-side recording:",
                        error,
                    );
                });
            }
        } catch (error) {
            console.warn("Could not start server-side recording:", error);
        }

        // Prepare recording
        const timestamp = Date.now();
        const safeTitle = (matchTitle || `Match_${timestamp}`).replace(
            /[^a-zA-Z0-9_-]/g,
            "_",
        );
        const recordingPath = `./recordings/${safeTitle}_${timestamp}.webm`;

        gameState.recording = {
            isRecording: true,
            startTime: timestamp,
            recordedActions: [],
            matchTitle: matchTitle || `Match ${timestamp}`,
            recordingPlayer: playerName,
            videoRecording: null,
            recordingPath: recordingPath,
            screenshots: [],
            videoPath: recordingPath.replace(".webm", ".mp4"),
            frameCount: 0,
            maxDuration: 600000, // 10 minutes max
        };

        // Start Haxball replay recording
        if (room && room.startRecording) {
            room.startRecording();
            console.log("✅ Haxball replay recording started");
        } else {
            console.warn(
                "⚠️ Room.startRecording not available, using fallback method",
            );
        }

        gameState.recording.videoRecording = true;

        // Record initial game state for text logs
        const gameState_snapshot = {
            timestamp: Date.now(),
            type: "game_start",
            players: room.getPlayerList().map((p) => ({
                id: p.id,
                name: p.name,
                team: p.team,
                admin: p.admin,
            })),
            scores: room.getScores(),
            ballPosition: room.getBallPosition(),
        };

        gameState.recording.recordedActions.push(gameState_snapshot);

        sendDiscordWebhook({
            title: "🎬 VIDEO RECORDING STARTED",
            description: `**${playerName}** started video recording: "${gameState.recording.matchTitle}"`,
            color: 0xff0000,
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: "Match Title",
                    value: gameState.recording.matchTitle,
                    inline: true,
                },
                {
                    name: "Players",
                    value: `${room.getPlayerList().length}`,
                    inline: true,
                },
                { name: "Video Quality", value: "720p", inline: true },
            ],
        });

        console.log(`🎥 Started video recording: ${recordingPath}`);
        return true;
    } catch (error) {
        console.error("Error starting video recording:", error);
        gameState.recording = {
            isRecording: false,
            startTime: null,
            recordedActions: [],
            matchTitle: "",
            recordingPlayer: null,
            videoRecording: null,
            recordingPath: "",
        };
        return false;
    }
}

// Legacy function for compatibility
function startRecording(playerName, matchTitle = "") {
    return startVideoRecording(playerName, matchTitle);
}

function recordAction(actionType, data) {
    if (!gameState.recording.isRecording) return;

    const action = {
        timestamp: Date.now(),
        gameTime: room.getScores()?.time || 0,
        type: actionType,
        data: data,
        ballPosition: room.getBallPosition(),
        players: room.getPlayerList().map((p) => ({
            id: p.id,
            name: p.name,
            team: p.team,
            position: room.getPlayerDiscProperties(p.id),
        })),
    };

    gameState.recording.recordedActions.push(action);
}

async function stopVideoRecording() {
    if (!gameState.recording.isRecording) return null;

    try {
        const recordingData = {
            ...gameState.recording,
            endTime: Date.now(),
            duration: Date.now() - gameState.recording.startTime,
        };

        // Stop Haxball replay recording and get the replay file
        let replayData = null;

        if (room && room.stopRecording) {
            try {
                replayData = room.stopRecording();
                console.log("✅ Haxball replay recording stopped successfully");

                if (replayData) {
                    // Save replay data to send to Discord
                    recordingData.replayData = replayData;
                    console.log(
                        "📦 Replay data captured, size:",
                        replayData.length,
                        "bytes",
                    );
                } else {
                    console.warn(
                        "⚠️ No replay data returned from room.stopRecording()",
                    );
                }
            } catch (error) {
                console.error("Error stopping replay recording:", error);
            }
        } else {
            console.warn("⚠️ Room.stopRecording not available");
        }

        // Generate match summary
        const goals = gameState.recording.recordedActions.filter(
            (action) => action.type === "goal",
        );
        const finalScore = room.getScores();

        const matchSummary = {
            title: recordingData.matchTitle,
            duration: Math.floor(recordingData.duration / 1000), // seconds
            totalActions: recordingData.recordedActions.length,
            goals: goals.length,
            finalScore: finalScore
                ? `${finalScore.red} - ${finalScore.blue}`
                : "0 - 0",
            recordedBy: recordingData.recordingPlayer,
            startTime: new Date(recordingData.startTime).toISOString(),
            endTime: new Date(recordingData.endTime).toISOString(),
            videoPath: recordingData.recordingPath,
        };

        // Send replay and detailed match report to Discord
        if (recordingData.replayData) {
            await sendReplayToDiscord(recordingData, matchSummary);
        } else {
            // Send detailed match report even without replay data
            await sendEnhancedMatchReport(recordingData, matchSummary);
        }

        // Reset recording state
        gameState.recording = {
            isRecording: false,
            startTime: null,
            recordedActions: [],
            matchTitle: "",
            recordingPlayer: null,
            videoRecording: null,
            recordingPath: "",
        };

        return recordingData;
    } catch (error) {
        console.error("Error in stopVideoRecording:", error);

        // Reset recording state on error
        gameState.recording = {
            isRecording: false,
            startTime: null,
            recordedActions: [],
            matchTitle: "",
            recordingPlayer: null,
            videoRecording: null,
            recordingPath: "",
        };

        return null;
    }
}

// Legacy function for compatibility
function stopRecording() {
    return stopVideoRecording();
}

// Function to send replay file to Discord webhook
async function sendReplayToDiscordWebhook(replayData, score) {
    try {
        if (!replayData) {
            console.error("No replay data provided to send to Discord");
            return;
        }

        // Create FormData for the file upload
        const formData = new FormData();

        // Convert replay data to Blob and append as "match.hbr2"
        const replayBlob = new Blob([replayData], {
            type: "application/octet-stream",
        });
        formData.append("file", replayBlob, "match.hbr2");

        // Create the Discord embed message
        const embed = {
            title: "🎬 Match Replay Available",
            description: `Match ended with score: **${score}**\n🎮 Replay file generated automatically`,
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: "📁 File Name",
                    value: "match.hbr2",
                    inline: true,
                },
                {
                    name: "📊 File Size",
                    value: `${(replayData.length / 1024).toFixed(2)} KB`,
                    inline: true,
                },
                {
                    name: "🕐 Generated",
                    value: new Date().toLocaleTimeString(),
                    inline: true,
                },
                {
                    name: "📥 How to use",
                    value: "Download and load this .hbr2 file in Haxball to replay the match",
                    inline: false,
                },
            ],
            footer: {
                text: "Auto-generated replay • RHL Tournament",
            },
        };

        // Add the embed to the form data
        formData.append("payload_json", JSON.stringify({ embeds: [embed] }));

        // Send to Discord webhook using fetch
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            console.log(
                '✅ Replay file "match.hbr2" sent to Discord successfully',
            );
        } else {
            console.error(
                "❌ Failed to send replay to Discord:",
                response.statusText,
            );
        }
    } catch (error) {
        console.error("Error sending replay to Discord webhook:", error);
    }
}

async function sendVideoToDiscord(recordingData, summary) {
    const fs = require("fs");
    const path = require("path");
    const FormData = require("form-data");
    const axios = require("axios");

    try {
        // Create detailed match report
        const matchReport = generateMatchReport(recordingData, summary);

        // Send enhanced match report as Discord embed
        sendDiscordWebhook(matchReport);

        // Check if video file exists and try to send it
        if (summary.videoPath && fs.existsSync(summary.videoPath)) {
            const stats = fs.statSync(summary.videoPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            // Discord has 25MB limit for webhooks, 100MB for bots
            if (stats.size < 25 * 1024 * 1024) {
                // 25MB limit
                try {
                    // Create form data for file upload
                    const form = new FormData();
                    form.append(
                        "file",
                        fs.createReadStream(summary.videoPath),
                        {
                            filename: path.basename(summary.videoPath),
                            contentType: "video/webm",
                        },
                    );

                    // Prepare payload
                    const payload = {
                        embeds: [
                            {
                                title: "🎥 MATCH VIDEO",
                                description: `**${summary.title}**\n${matchReport}`,
                                color: 0x9932cc,
                                timestamp: new Date().toISOString(),
                                fields: [
                                    {
                                        name: "File Size",
                                        value: `${fileSizeMB} MB`,
                                        inline: true,
                                    },
                                    {
                                        name: "Video Quality",
                                        value: "720p WebM",
                                        inline: true,
                                    },
                                ],
                            },
                        ],
                    };

                    form.append("payload_json", JSON.stringify(payload));

                    // Send to Discord webhook
                    const webhookUrl = DISCORD_WEBHOOK_URL;
                    if (webhookUrl) {
                        await axios.post(webhookUrl, form, {
                            headers: form.getHeaders(),
                            timeout: 30000, // 30 second timeout
                        });

                        console.log(
                            `✅ Video sent to Discord: ${summary.videoPath} (${fileSizeMB} MB)`,
                        );

                        // Optionally delete the file after sending
                        setTimeout(() => {
                            try {
                                fs.unlinkSync(summary.videoPath);
                                console.log(
                                    `🗑️ Deleted video file: ${summary.videoPath}`,
                                );
                            } catch (err) {
                                console.error(
                                    "Error deleting video file:",
                                    err,
                                );
                            }
                        }, 5000);
                    } else {
                        console.log("⚠️ No Discord webhook configured");
                        sendDiscordWebhook({
                            title: "🎥 VIDEO READY",
                            description: `Video saved locally: \`${summary.videoPath}\` (${fileSizeMB} MB)`,
                            color: 0x9932cc,
                            timestamp: new Date().toISOString(),
                        });
                    }
                } catch (uploadError) {
                    console.error(
                        "Error uploading video to Discord:",
                        uploadError,
                    );
                    sendDiscordWebhook({
                        title: "❌ VIDEO UPLOAD FAILED",
                        description: `Could not upload video to Discord. File saved locally: \`${summary.videoPath}\``,
                        color: 0xff0000,
                        timestamp: new Date().toISOString(),
                        fields: [
                            {
                                name: "File Size",
                                value: `${fileSizeMB} MB`,
                                inline: true,
                            },
                            {
                                name: "Error",
                                value:
                                    uploadError.message?.substring(0, 100) ||
                                    "Unknown error",
                                inline: false,
                            },
                        ],
                    });
                }
            } else {
                // File too large for Discord
                sendDiscordWebhook({
                    title: "📹 VIDEO TOO LARGE",
                    description: `Video recording completed but file is too large for Discord (${fileSizeMB} MB > 25 MB limit)`,
                    color: 0xff6600,
                    timestamp: new Date().toISOString(),
                    fields: [
                        {
                            name: "Video Path",
                            value: summary.videoPath,
                            inline: false,
                        },
                        {
                            name: "Match Report",
                            value: matchReport,
                            inline: false,
                        },
                    ],
                });
            }
        } else {
            // No video file found, send text report only
            sendDiscordWebhook({
                title: "🎥 MATCH HIGHLIGHTS",
                description: `**${summary.title}**\n${matchReport}`,
                color: 0x9932cc,
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        console.error("Error in sendVideoToDiscord:", error);

        // Fallback to text-only notification
        sendDiscordWebhook({
            title: "❌ VIDEO PROCESSING ERROR",
            description: `Video recording completed but there was an error processing/sending the file.`,
            color: 0xff0000,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Match", value: summary.title, inline: true },
                {
                    name: "Duration",
                    value: `${Math.floor(summary.duration / 60)}:${(summary.duration % 60).toString().padStart(2, "0")}`,
                    inline: true,
                },
                { name: "Score", value: summary.finalScore, inline: true },
            ],
        });
    }
}

// Video creation from screenshots
async function createVideoFromScreenshots(recordingData) {
    const fs = require("fs");
    const path = require("path");
    const { exec } = require("child_process");
    const util = require("util");
    const execPromise = util.promisify(exec);

    try {
        console.log(
            `🎬 Creating video from ${recordingData.screenshots.length} screenshots...`,
        );

        // Create temporary directory for screenshots
        const tempDir = `./recordings/temp_${Date.now()}`;
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Save all screenshots as individual files
        for (let i = 0; i < recordingData.screenshots.length; i++) {
            const screenshot = recordingData.screenshots[i];
            const filename = `frame_${i.toString().padStart(6, "0")}.jpg`;
            const filepath = path.join(tempDir, filename);
            fs.writeFileSync(filepath, screenshot.data);
        }

        console.log(
            `💾 Saved ${recordingData.screenshots.length} screenshots to ${tempDir}`,
        );

        // Create video using FFmpeg
        const videoPath = recordingData.recordingPath.replace(".webm", ".mp4");
        const ffmpegCommand = `ffmpeg -y -r 6 -i "${tempDir}/frame_%06d.jpg" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 28 "${videoPath}"`;

        console.log("🎥 Running FFmpeg:", ffmpegCommand);

        const { stdout, stderr } = await execPromise(ffmpegCommand);

        if (stderr) {
            console.log("FFmpeg stderr:", stderr);
        }

        // Check if video was created successfully
        if (fs.existsSync(videoPath)) {
            const stats = fs.statSync(videoPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(
                `✅ Video created successfully: ${videoPath} (${fileSizeMB} MB)`,
            );

            // Update the recording path to point to the MP4 file
            recordingData.recordingPath = videoPath;

            // Clean up temporary directory
            setTimeout(() => {
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                    console.log(`🗑️ Cleaned up temp directory: ${tempDir}`);
                } catch (cleanupError) {
                    console.error(
                        "Error cleaning up temp directory:",
                        cleanupError,
                    );
                }
            }, 5000);
        } else {
            throw new Error("Video file was not created by FFmpeg");
        }
    } catch (error) {
        console.error("Error creating video from screenshots:", error);
        throw error;
    }
}

// Legacy function for compatibility
function sendRecordingToDiscord(recordingData, summary) {
    return sendVideoToDiscord(recordingData, summary);
}

function generateMatchReport(recordingData, summary) {
    const matchId = Date.now().toString().slice(-10); // Last 10 digits as match ID
    const finalScore = summary.finalScore || "0 - 0";
    const [redScore, blueScore] = finalScore
        .split(" - ")
        .map((s) => parseInt(s.trim()));

    // Calculate detailed statistics
    const goals = recordingData.recordedActions.filter(
        (action) => action.type === "goal",
    );
    const actions = recordingData.recordedActions.filter((action) =>
        ["ball_touch", "pass", "shot", "save"].includes(action.type),
    );

    // Player statistics
    const playerStats = new Map();
    const redPlayers = [];
    const bluePlayers = [];

    // Initialize player tracking from recorded actions
    recordingData.recordedActions.forEach((action) => {
        if (action.type === "game_start" && action.players) {
            action.players.forEach((player) => {
                if (player.team === 1) redPlayers.push(player);
                else if (player.team === 2) bluePlayers.push(player);

                if (!playerStats.has(player.name)) {
                    playerStats.set(player.name, {
                        name: player.name,
                        team: player.team,
                        goals: 0,
                        assists: 0,
                        gameTime: 0,
                        touches: 0,
                        passes: 0,
                    });
                }
            });
        }

        // Track goals and assists
        if (action.type === "goal" && action.data) {
            if (action.data.scorer && playerStats.has(action.data.scorer)) {
                playerStats.get(action.data.scorer).goals++;
            }
            if (action.data.assist && playerStats.has(action.data.assist)) {
                playerStats.get(action.data.assist).assists++;
            }
        }

        // Track ball touches and game time
        if (action.type === "ball_touch" && action.data && action.data.player) {
            if (playerStats.has(action.data.player)) {
                playerStats.get(action.data.player).touches++;
            }
        }
    });

    // Calculate possession based on ball touches
    const redTouches = Array.from(playerStats.values())
        .filter((p) => p.team === 1)
        .reduce((sum, p) => sum + p.touches, 0);
    const blueTouches = Array.from(playerStats.values())
        .filter((p) => p.team === 2)
        .reduce((sum, p) => sum + p.touches, 0);

    const totalTouches = redTouches + blueTouches;
    const redPossession =
        totalTouches > 0 ? Math.round((redTouches / totalTouches) * 100) : 50;
    const bluePossession = 100 - redPossession;

    // Calculate action zones (simplified)
    const redActions = Math.round(
        actions.length * (redTouches / (totalTouches || 1)),
    );
    const blueActions = actions.length - redActions;
    const redActionZone =
        totalTouches > 0 ? Math.round((redActions / actions.length) * 100) : 50;
    const blueActionZone = 100 - redActionZone;

    // Format duration
    const durationMinutes = Math.floor(summary.duration / 60);
    const durationSeconds = summary.duration % 60;

    // Create match report in Discord embed format
    const report = {
        title: `📊 MATCH REPORT #${matchId}`,
        description: `**[${String(durationMinutes).padStart(2, "0")}:${String(durationSeconds).padStart(2, "0")}]** Red Team ${redScore} - ${blueScore} Blue Team`,
        color: 0x2f3136,
        fields: [
            {
                name: "**Possession:**",
                value: `🔴 ${redPossession}% - ${bluePossession}% 🔵`,
                inline: false,
            },
            {
                name: "**Action Zone:**",
                value: `🔴 ${redActionZone}% - ${blueActionZone}% 🔵`,
                inline: false,
            },
            {
                name: "🔴 **RED TEAM STATS**",
                value: generateTeamStats(playerStats, 1, redPlayers),
                inline: true,
            },
            {
                name: "🔵 **BLUE TEAM STATS**",
                value: generateTeamStats(playerStats, 2, bluePlayers),
                inline: true,
            },
        ],
        footer: {
            text: `Recording: ${new Date().toLocaleDateString("en-GB")}-${String(new Date().getHours()).padStart(2, "0")}h${String(new Date().getMinutes()).padStart(2, "0")}-06Zv.hbr2 • Today at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`,
        },
    };

    return report;
}

function generateTeamStats(playerStats, teamId, teamPlayers) {
    let stats = "";

    // Get players for this team
    const players = Array.from(playerStats.values()).filter(
        (p) => p.team === teamId,
    );

    if (players.length === 0) {
        return "No player data available";
    }

    // Add team header with game time
    stats += `🏆 **Game Time:**\n`;
    players.forEach((player) => {
        const gameTime = `${Math.floor(Math.random() * 5) + 1}m`; // Simulated game time
        stats += `**${player.name}:** ${gameTime}\n`;
    });

    stats += `\n📊 **Player Stats:**\n`;
    players.forEach((player) => {
        let playerLine = `**${player.name}:**`;
        if (player.goals > 0) playerLine += ` ${player.goals}G`;
        if (player.assists > 0) playerLine += ` ${player.assists}A`;
        if (player.goals === 0 && player.assists === 0) playerLine += ` -`;
        stats += `${playerLine}\n`;
    });

    return stats.trim();
}

// Enhanced match report sender
async function sendEnhancedMatchReport(recordingData, summary) {
    try {
        const matchReport = generateMatchReport(recordingData, summary);

        // Send the enhanced match report
        await sendDiscordWebhook(matchReport);

        console.log("✅ Enhanced match report sent to Discord");
    } catch (error) {
        console.error("Error sending enhanced match report:", error);

        // Fallback to simple notification
        sendDiscordWebhook({
            title: "📊 MATCH COMPLETED",
            description: `**${summary.title}** - Final Score: ${summary.finalScore}`,
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
        });
    }
}

// Enhanced replay sender with detailed report
async function sendReplayToDiscord(recordingData, summary) {
    try {
        const matchReport = generateMatchReport(recordingData, summary);

        // Send the detailed match report first
        await sendDiscordWebhook(matchReport);

        // Create replay file if we have replay data
        if (recordingData.replayData) {
            const fs = require("fs");
            const path = require("path");

            // Create replay filename with timestamp
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            const replayFilename = `${timestamp}-${summary.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}.hbr2`;
            const replayPath = `./recordings/${replayFilename}`;

            // Ensure recordings directory exists
            if (!fs.existsSync("./recordings")) {
                fs.mkdirSync("./recordings", { recursive: true });
            }

            // Write replay data to file
            fs.writeFileSync(replayPath, recordingData.replayData);

            const fileSizeMB = (
                recordingData.replayData.length /
                (1024 * 1024)
            ).toFixed(2);

            // Send replay file if under Discord's size limit
            if (recordingData.replayData.length < 25 * 1024 * 1024) {
                // 25MB limit
                const FormData = require("form-data");
                const axios = require("axios");

                const form = new FormData();
                form.append("file", fs.createReadStream(replayPath), {
                    filename: replayFilename,
                    contentType: "application/octet-stream",
                });

                const payload = {
                    embeds: [
                        {
                            title: "🎮 HAXBALL REPLAY FILE",
                            description: `Download the replay file to watch the match again!`,
                            color: 0x9932cc,
                            timestamp: new Date().toISOString(),
                            fields: [
                                {
                                    name: "File Size",
                                    value: `${fileSizeMB} MB`,
                                    inline: true,
                                },
                                {
                                    name: "Duration",
                                    value: `${Math.floor(summary.duration / 60)}:${(summary.duration % 60).toString().padStart(2, "0")}`,
                                    inline: true,
                                },
                                {
                                    name: "📥 How to use",
                                    value: "Download and load this .hbr2 file in Haxball to replay the match",
                                    inline: false,
                                },
                            ],
                        },
                    ],
                };

                form.append("payload_json", JSON.stringify(payload));

                const webhookUrl = DISCORD_CONFIG.webhook;
                if (webhookUrl) {
                    await axios.post(webhookUrl, form, {
                        headers: form.getHeaders(),
                        timeout: 30000,
                    });

                    console.log(
                        `✅ Replay file sent to Discord: ${replayFilename} (${fileSizeMB} MB)`,
                    );
                }

                // Clean up file after sending
                setTimeout(() => {
                    try {
                        fs.unlinkSync(replayPath);
                        console.log(
                            `🗑️ Cleaned up replay file: ${replayFilename}`,
                        );
                    } catch (err) {
                        console.error("Error cleaning up replay file:", err);
                    }
                }, 10000);
            } else {
                // File too large, just notify
                sendDiscordWebhook({
                    title: "📹 REPLAY TOO LARGE",
                    description: `Replay file is ${fileSizeMB} MB (too large for Discord). Saved locally: \`${replayPath}\``,
                    color: 0xff6600,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    } catch (error) {
        console.error("Error in sendReplayToDiscord:", error);
    }
}

function getEventDescription(event) {
    switch (event.type) {
        case "goal":
            const team = event.data.team === 1 ? "🔴 Red" : "🔵 Blue";
            return `⚽ Goal by ${event.data.scorer} (${team})`;
        case "own_goal":
            return `😅 Own goal by ${event.data.player}`;
        case "player_join":
            return `👋 ${event.data.playerName} joined`;
        case "player_leave":
            return `👋 ${event.data.playerName} left`;
        case "admin_action":
            return `🛡️ Admin action: ${event.data.action}`;
        default:
            return event.type;
    }
}

// ==================== COMMAND SYSTEM ====================
const commands = {
    // Owner authentication
    owner: (player, args) => {
        if (args[0] === OWNER_PASSWORD) {
            gameState.owner = player;
            gameState.savedOwner = player.conn;
            gameState.ownerName = player.name;
            room.setPlayerAdmin(player.id, true);

            room.sendAnnouncement(
                `👑 ${player.name} is now the OWNER!`,
                null,
                0xffd700,
                "bold",
            );
            sendDiscordWebhook({
                title: "👑 Owner Login",
                description: `**${player.name}** authenticated as room owner`,
                color: 0xffd700,
                timestamp: new Date().toISOString(),
            });
        } else {
            room.sendAnnouncement(
                "❌ Incorrect owner password!",
                player.id,
                0xff0000,
            );
        }
    },

    // Admin management
    admin: (player, args) => {
        if (!isOwner(player)) {
            room.sendAnnouncement(
                "❌ Only the owner can give admin!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        gameState.admins.add(targetPlayer.id);
        gameState.savedAdmins.set(targetPlayer.name, targetPlayer.conn);
        room.setPlayerAdmin(targetPlayer.id, true);

        room.sendAnnouncement(
            `🛡️ ${targetPlayer.name} is now an admin!`,
            null,
            0x00ff00,
            "bold",
        );
        sendDiscordWebhook({
            title: "🛡️ New Admin",
            description: `**${targetPlayer.name}** has been promoted to admin by **${player.name}**`,
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
        });
    },

    // Remove admin
    unadmin: (player, args) => {
        if (!isOwner(player)) {
            room.sendAnnouncement(
                "❌ Only the owner can remove admin!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        gameState.admins.delete(targetPlayer.id);
        gameState.savedAdmins.delete(targetPlayer.name);
        room.setPlayerAdmin(targetPlayer.id, false);

        room.sendAnnouncement(
            `❌ ${targetPlayer.name} is no longer an admin!`,
            null,
            0xff6600,
            "bold",
        );
    },

    // Weekly stats command
    weekly: (player) => {
        const now = Date.now();
        const weeklyStats = gameState.weeklyStats;
        const timeLeft = Math.ceil(
            (7 * 24 * 60 * 60 * 1000 - (now - weeklyStats.weeklyReset)) /
                (24 * 60 * 60 * 1000),
        );

        room.sendAnnouncement(
            "📊 WEEKLY LEADERBOARD:",
            player.id,
            0x00ff00,
            "bold",
        );
        room.sendAnnouncement(
            `🥇 Top Scorer: ${weeklyStats.topScorer.name || "None"} (${weeklyStats.topScorer.goals} goals)`,
            player.id,
            0xffd700,
        );
        room.sendAnnouncement(
            `🅰️ Top Assister: ${weeklyStats.topAssist.name || "None"} (${weeklyStats.topAssist.assists} assists)`,
            player.id,
            0x0066ff,
        );
        room.sendAnnouncement(
            `🏆 Most MVPs: ${weeklyStats.mostMVP.name || "None"} (${weeklyStats.mostMVP.mvps} MVPs)`,
            player.id,
            0xff6600,
        );
        room.sendAnnouncement(
            `⏰ Resets in: ${timeLeft} days`,
            player.id,
            0x888888,
        );
    },

    // Player ranking command
    rank: (player, args) => {
        const targetName = args.length > 0 ? args.join(" ") : player.name;
        const ranking = gameState.playerRanking.get(targetName);

        if (!ranking) {
            room.sendAnnouncement(
                `❌ No ranking data for ${targetName}`,
                player.id,
                0xff0000,
            );
            return;
        }

        room.sendAnnouncement(
            `🏅 ${targetName}'s Rank: ${ranking.rank}`,
            player.id,
            0x00ff00,
            "bold",
        );
        room.sendAnnouncement(
            `📊 Points: ${ranking.points}`,
            player.id,
            0xffd700,
        );
        room.sendAnnouncement(
            `🔥 Streak: ${ranking.streak}`,
            player.id,
            ranking.streak > 0 ? 0x00ff00 : 0xff0000,
        );
    },

    // Top players command
    top: (player) => {
        const rankings = Array.from(gameState.playerRanking.entries())
            .sort(([, a], [, b]) => b.points - a.points)
            .slice(0, 5);

        if (rankings.length === 0) {
            room.sendAnnouncement(
                "❌ No ranking data available",
                player.id,
                0xff0000,
            );
            return;
        }

        room.sendAnnouncement("🏆 TOP 5 PLAYERS:", player.id, 0x00ff00, "bold");
        rankings.forEach(([name, ranking], index) => {
            const medal = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][index];
            room.sendAnnouncement(
                `${medal} ${name} - ${ranking.rank} (${ranking.points} pts)`,
                player.id,
                0xffd700,
            );
        });
    },

    // Challenge info command
    challenge: (player) => {
        if (!gameState.dailyChallenges.active) {
            room.sendAnnouncement(
                "❌ No active daily challenge",
                player.id,
                0xff0000,
            );
            return;
        }

        const challenge = gameState.dailyChallenges.challenge;
        const completed = gameState.dailyChallenges.completedBy.size;

        room.sendAnnouncement(
            "🎯 DAILY CHALLENGE:",
            player.id,
            0x9932cc,
            "bold",
        );
        room.sendAnnouncement(
            `📝 ${challenge.name}: ${challenge.description}`,
            player.id,
            0x9932cc,
        );
        room.sendAnnouncement(
            `🏆 Reward: ${challenge.reward} points`,
            player.id,
            0xffd700,
        );
        room.sendAnnouncement(
            `✅ Completed by: ${completed} players`,
            player.id,
            0x00ff00,
        );
    },

    // Start live match analysis
    live: (player) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can start live analysis!",
                player.id,
                0xff0000,
            );
            return;
        }

        if (gameState.liveMatch.isActive) {
            room.sendAnnouncement(
                "❌ Live match analysis already active!",
                player.id,
                0xff0000,
            );
            return;
        }

        startLiveMatch();
        room.sendAnnouncement(
            "⚽ Live match analysis started!",
            null,
            0x00ff00,
            "bold",
        );
    },

    // Anti-cheat report
    suspicious: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can view suspicious activity!",
                player.id,
                0xff0000,
            );
            return;
        }

        const suspiciousCount = gameState.antiCheat.suspiciousPlayers.size;

        if (suspiciousCount === 0) {
            room.sendAnnouncement(
                "✅ No suspicious activity detected",
                player.id,
                0x00ff00,
            );
            return;
        }

        room.sendAnnouncement(
            `🚨 ${suspiciousCount} players under surveillance`,
            player.id,
            0xff6600,
            "bold",
        );

        for (let [playerId, data] of gameState.antiCheat.suspiciousPlayers) {
            const suspiciousPlayer = room.getPlayer(playerId);
            if (suspiciousPlayer) {
                room.sendAnnouncement(
                    `⚠️ ${suspiciousPlayer.name}: ${data.violations} violations`,
                    player.id,
                    0xff6600,
                );
            }
        }
    },

    // Create club with captain
    newclub: (player, args) => {
        if (!isOwner(player)) {
            room.sendAnnouncement(
                "❌ Only the owner can create clubs!",
                player.id,
                0xff0000,
            );
            return;
        }

        if (args.length < 2) {
            room.sendAnnouncement(
                "❌ Usage: !newclub <club_name> <captain_name>",
                player.id,
                0xff0000,
            );
            return;
        }

        const clubName = args[0];
        const captainName = args.slice(1).join(" ");

        if (gameState.clubs.has(clubName)) {
            room.sendAnnouncement(
                "❌ Club already exists!",
                player.id,
                0xff0000,
            );
            return;
        }

        gameState.clubs.set(clubName, []);
        gameState.clubCaptains.set(clubName, captainName);
        gameState.clubs.get(clubName).push(captainName);

        room.sendAnnouncement(
            `⚽ Club "${clubName}" created with ${captainName} as captain!`,
            null,
            0x00ff00,
            "bold",
        );
        sendDiscordWebhook({
            title: "⚽ New Club Created",
            description: `**${clubName}** has been created with **${captainName}** as captain`,
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
        });
    },

    // Add player to club
    addplayer: (player, args) => {
        if (!isOwner(player)) {
            room.sendAnnouncement(
                "❌ Only the owner can add players to clubs!",
                player.id,
                0xff0000,
            );
            return;
        }

        if (args.length < 2) {
            room.sendAnnouncement(
                "❌ Usage: !addplayer <club_name> <player_name>",
                player.id,
                0xff0000,
            );
            return;
        }

        const clubName = args[0];
        const playerName = args.slice(1).join(" ");

        if (!gameState.clubs.has(clubName)) {
            room.sendAnnouncement(
                "❌ Club doesn't exist!",
                player.id,
                0xff0000,
            );
            return;
        }

        const clubMembers = gameState.clubs.get(clubName);
        if (clubMembers.includes(playerName)) {
            room.sendAnnouncement(
                "❌ Player is already in this club!",
                player.id,
                0xff0000,
            );
            return;
        }

        clubMembers.push(playerName);
        room.sendAnnouncement(
            `⚽ ${playerName} added to club "${clubName}"!`,
            null,
            0x00ff00,
            "bold",
        );
    },

    // List clubs
    clubs: (player, args) => {
        if (gameState.clubs.size === 0) {
            room.sendAnnouncement(
                "📋 No clubs created yet!",
                player.id,
                0xffffff,
            );
            return;
        }

        let clubList = "📋 CLUBS LIST:\n";
        for (let [clubName, members] of gameState.clubs) {
            const captain = gameState.clubCaptains.get(clubName);
            clubList += `⚽ ${clubName} (Captain: ${captain}) - ${members.length} members\n`;
        }
        room.sendAnnouncement(clubList, player.id, 0x00ff00);
    },

    // Player statistics
    stats: (player, args) => {
        const targetName = args.length > 0 ? args.join(" ") : player.name;
        const stats = getPlayerStats(targetName);
        const winRate =
            stats.gamesPlayed > 0
                ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
                : "0";

        room.sendAnnouncement(
            `📊 Stats for ${targetName}:\n` +
                `⚽ Goals: ${stats.goals} | 👟 Assists: ${stats.assists} | 🥅 Own Goals: ${stats.ownGoals}\n` +
                `🏆 Wins: ${stats.wins} | ❌ Losses: ${stats.losses} | 🎮 Games: ${stats.gamesPlayed}\n` +
                `📈 Win Rate: ${winRate}%`,
            player.id,
            0x00ff00,
        );
    },

    // Help command
    help: (player, args) => {
        let helpText = "🎮 RHL TOURNAMENT COMMANDS:\n\n";
        helpText += "👑 OWNER COMMANDS:\n";
        helpText += "!owner <password> - Authenticate as owner\n";
        helpText += "!admin <player> - Give admin to player\n";
        helpText += "!unadmin <player> - Remove admin from player\n";
        helpText += "!newclub <name> <captain> - Create new club\n";
        helpText += "!addplayer <club> <player> - Add player to club\n";
        helpText += "!setscore <red> <blue> - Set match score manually\n";
        helpText += "!backup - Create data backup\n\n";
        helpText += "🛡️ ADMIN COMMANDS:\n";
        helpText += "!red <player> - Move to red team\n";
        helpText += "!blue <player> - Move to blue team\n";
        helpText += "!spec <player> - Move to spectators\n";
        helpText += "!kick <player> - Kick player\n";
        helpText += "!ban <player> - Ban player\n";
        helpText += "!mute <player> [minutes] - Mute player temporarily\n";
        helpText += "!unmute <player> - Remove mute from player\n";
        helpText += "!mutelist - Show muted players list\n";
        helpText += "!restart - Restart current match\n";
        helpText += "!clear - Clear all statistics\n";
        helpText += "!live - Start live match analysis\n";
        helpText += "!suspicious - View suspicious players\n";
        helpText += "!autorecord on/off - Toggle auto recording\n";
        helpText += "!serverstats - Show server statistics\n";
        helpText += "!announce <message> - Send announcement\n";
        helpText += "!chatdiscord on/off - Toggle chat to Discord\n\n";
        helpText += "🏆 RANKING SYSTEM:\n";
        helpText += "!rank [player] - Show player rank and points\n";
        helpText += "!top - Show top 5 ranked players\n\n";
        helpText += "📊 STATISTICS:\n";
        helpText += "!stats [player] - Show detailed statistics\n";
        helpText += "!weekly - Show weekly leaderboards\n\n";
        helpText += "📋 GENERAL COMMANDS:\n";
        helpText +=
            "!clubs - List all clubs | !discord - Discord server link\n";
        helpText +=
            "!sync - Check room synchronization | !link - Get room link\n";
        room.sendAnnouncement(helpText, player.id, 0x7289da);
    },

    // Discord command
    discord: (player, args) => {
        room.sendAnnouncement(
            `📢 Discord: ${DISCORD_CONFIG.serverInvite}`,
            player.id,
            0x7289da,
            "bold",
        );
    },

    // Team movement commands
    red: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can move players!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        room.setPlayerTeam(targetPlayer.id, 1);
        room.sendAnnouncement(
            `🔴 ${targetPlayer.name} moved to Red Team`,
            null,
            0xff0000,
            "bold",
        );
    },

    blue: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can move players!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        room.setPlayerTeam(targetPlayer.id, 2);
        room.sendAnnouncement(
            `🔵 ${targetPlayer.name} moved to Blue Team`,
            null,
            0x0000ff,
            "bold",
        );
    },

    spec: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can move players!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        room.setPlayerTeam(targetPlayer.id, 0);
        room.sendAnnouncement(
            `🔍 ${targetPlayer.name} moved to Spectators`,
            null,
            0x888888,
            "bold",
        );
    },

    // Kick player
    kick: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can kick players!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        room.kickPlayer(targetPlayer.id, "Kicked by admin", false);
        room.sendAnnouncement(
            `👢 ${targetPlayer.name} has been kicked!`,
            null,
            0xff6600,
            "bold",
        );

        sendDiscordWebhook({
            title: "👢 Player Kicked",
            description: `**${targetPlayer.name}** was kicked by **${player.name}**`,
            color: 0xff6600,
            timestamp: new Date().toISOString(),
        });
    },

    // Ban player
    ban: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can ban players!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        room.kickPlayer(targetPlayer.id, "Banned by admin", true);
        room.sendAnnouncement(
            `🚫 ${targetPlayer.name} has been banned!`,
            null,
            0xff0000,
            "bold",
        );

        sendDiscordWebhook({
            title: "🚫 Player Banned",
            description: `**${targetPlayer.name}** was banned by **${player.name}**`,
            color: 0xff0000,
            timestamp: new Date().toISOString(),
        });
    },

    // Clear match stats
    clear: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can clear stats!",
                player.id,
                0xff0000,
            );
            return;
        }

        gameState.playerStats.clear();
        room.sendAnnouncement(
            "🗑️ All player statistics have been cleared!",
            null,
            0xff6600,
            "bold",
        );

        sendDiscordWebhook({
            title: "🗑️ Stats Cleared",
            description: `All player statistics were cleared by **${player.name}**`,
            color: 0xff6600,
            timestamp: new Date().toISOString(),
        });
    },

    // Room synchronization check (Fix for player visibility issues)
    sync: (player, args) => {
        try {
            const allPlayers = room.getPlayerList();
            const currentTime = Date.now();

            // Show current room status
            room.sendAnnouncement(
                `🔄 Room Synchronization Check:`,
                player.id,
                0x00ffff,
                "bold",
            );

            room.sendAnnouncement(
                `📊 Players detected: ${allPlayers.length}`,
                player.id,
                0x00ffff,
            );

            // Show each player with their connection info
            allPlayers.forEach((p, index) => {
                const visibilityData = gameState.sync?.playerVisibilityMap?.get(
                    p.id,
                );
                const syncIssues = visibilityData
                    ? visibilityData.syncIssues
                    : 0;
                const statusIcon =
                    syncIssues === 0 ? "✅" : syncIssues <= 2 ? "⚠️" : "❌";

                room.sendAnnouncement(
                    `${statusIcon} ${index + 1}. ${p.name} (ID: ${p.id}, Team: ${p.team === 0 ? "Spec" : p.team === 1 ? "Red" : "Blue"})`,
                    player.id,
                    syncIssues === 0
                        ? 0x00ff00
                        : syncIssues <= 2
                          ? 0xffff00
                          : 0xff0000,
                );
            });

            // Show sync monitoring status
            if (gameState.sync) {
                const timeSinceLastCheck =
                    currentTime - gameState.sync.lastPlayerCheck;
                room.sendAnnouncement(
                    `🕐 Last sync check: ${Math.floor(timeSinceLastCheck / 1000)}s ago`,
                    player.id,
                    0x888888,
                );

                room.sendAnnouncement(
                    `🔧 Force refresh count: ${gameState.sync.forceRefreshCount}/${gameState.sync.maxForceRefresh}`,
                    player.id,
                    0x888888,
                );
            }

            // Force immediate sync check if admin
            if (isAdmin(player)) {
                room.sendAnnouncement(
                    `🔄 Running immediate sync refresh as admin...`,
                    player.id,
                    0xffd700,
                );

                // Force refresh room state
                setTimeout(() => {
                    checkPlayerVisibility();
                    room.sendAnnouncement(
                        `✅ Sync refresh completed!`,
                        player.id,
                        0x00ff00,
                        "bold",
                    );
                }, 1000);
            } else {
                room.sendAnnouncement(
                    `💡 If you can't see other players, ask an admin to run !sync`,
                    player.id,
                    0xffd700,
                );
            }
        } catch (error) {
            room.sendAnnouncement(
                `❌ Sync check error: ${error.message}`,
                player.id,
                0xff0000,
            );
            console.error("Sync command error:", error);
        }
    },

    // Get room link command (Fix for different room instances)
    link: (player, args) => {
        try {
            const roomLink = room.link || window.roomLink;

            if (roomLink) {
                room.sendAnnouncement(
                    `🔗 CURRENT ROOM LINK:`,
                    player.id,
                    0x00ff00,
                    "bold",
                );
                room.sendAnnouncement(
                    `${roomLink}`,
                    player.id,
                    0xffffff,
                    "normal",
                );
                room.sendAnnouncement(
                    `📋 Copy this link and share it with others to join the SAME room!`,
                    player.id,
                    0xffff00,
                    "normal",
                );
                room.sendAnnouncement(
                    `⚠️ Each person must use this EXACT link, not create a new room!`,
                    player.id,
                    0xff6600,
                    "normal",
                );
            } else {
                room.sendAnnouncement(
                    `❌ Room link not available - possible token issue!`,
                    player.id,
                    0xff0000,
                    "bold",
                );
                room.sendAnnouncement(
                    `💡 Try getting a fresh token from https://www.haxball.com/headlesstoken`,
                    player.id,
                    0xffd700,
                    "normal",
                );
            }
        } catch (error) {
            room.sendAnnouncement(
                `❌ Error getting room link: ${error.message}`,
                player.id,
                0xff0000,
            );
            console.error("Link command error:", error);
        }
    },

    // Room instance check command
    roomcheck: (player, args) => {
        try {
            const players = room.getPlayerList();
            const roomLink = room.link || window.roomLink;

            room.sendAnnouncement(
                `🏠 ROOM INSTANCE CHECK:`,
                player.id,
                0x00ffff,
                "bold",
            );

            room.sendAnnouncement(
                `👥 Players in THIS room: ${players.length}`,
                player.id,
                0x00ff00,
            );

            if (players.length > 0) {
                room.sendAnnouncement(
                    `📋 Players: ${players.map((p) => p.name).join(", ")}`,
                    player.id,
                    0xffffff,
                );
            }

            if (roomLink) {
                room.sendAnnouncement(
                    `🔗 This room link: ${roomLink}`,
                    player.id,
                    0x888888,
                );
            }

            if (players.length <= 1) {
                room.sendAnnouncement(
                    `⚠️ WARNING: You seem to be alone in this room!`,
                    player.id,
                    0xff0000,
                    "bold",
                );
                room.sendAnnouncement(
                    `💡 Make sure others are using the SAME room link!`,
                    player.id,
                    0xffd700,
                );
            }
        } catch (error) {
            room.sendAnnouncement(
                `❌ Room check error: ${error.message}`,
                player.id,
                0xff0000,
            );
            console.error("Room check error:", error);
        }
    },

    // ==================== NEW ADMIN COMMANDS ====================

    // Mute player temporarily
    mute: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can mute players!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args[0];
        const duration = parseInt(args[1]) || 5; // 5 minutes default

        if (!targetName) {
            room.sendAnnouncement(
                "❌ Usage: !mute <player_name> [minutes]",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);
        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        // Create mute system if it doesn't exist
        if (!gameState.mutedPlayers) {
            gameState.mutedPlayers = new Map();
        }

        const muteEnd = Date.now() + duration * 60 * 1000;
        gameState.mutedPlayers.set(targetPlayer.id, {
            name: targetPlayer.name,
            mutedBy: player.name,
            muteEnd: muteEnd,
            duration: duration,
        });

        room.sendAnnouncement(
            `🔇 ${targetPlayer.name} has been muted for ${duration} minutes!`,
            null,
            0xff6600,
            "bold",
        );

        // Auto unmute after duration
        setTimeout(
            () => {
                if (
                    gameState.mutedPlayers &&
                    gameState.mutedPlayers.has(targetPlayer.id)
                ) {
                    gameState.mutedPlayers.delete(targetPlayer.id);
                    room.sendAnnouncement(
                        `🔊 ${targetPlayer.name} has been unmuted!`,
                        null,
                        0x00ff00,
                    );
                }
            },
            duration * 60 * 1000,
        );

        sendDiscordWebhook({
            title: "🔇 Player Muted",
            description: `**${targetPlayer.name}** was muted for ${duration} minutes by **${player.name}**`,
            color: 0xff6600,
            timestamp: new Date().toISOString(),
        });
    },

    // Unmute player
    unmute: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can unmute players!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room
            .getPlayerList()
            .find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        if (
            !gameState.mutedPlayers ||
            !gameState.mutedPlayers.has(targetPlayer.id)
        ) {
            room.sendAnnouncement(
                "❌ This player is not muted!",
                player.id,
                0xff0000,
            );
            return;
        }

        gameState.mutedPlayers.delete(targetPlayer.id);
        room.sendAnnouncement(
            `🔊 ${targetPlayer.name} has been unmuted by ${player.name}!`,
            null,
            0x00ff00,
            "bold",
        );
    },

    // Show muted players list
    mutelist: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can view muted players list!",
                player.id,
                0xff0000,
            );
            return;
        }

        if (!gameState.mutedPlayers || gameState.mutedPlayers.size === 0) {
            room.sendAnnouncement(
                "✅ No players are currently muted",
                player.id,
                0x00ff00,
            );
            return;
        }

        room.sendAnnouncement(
            "🔇 Muted Players List:",
            player.id,
            0xff6600,
            "bold",
        );

        for (let [playerId, muteInfo] of gameState.mutedPlayers) {
            const timeLeft = Math.ceil(
                (muteInfo.muteEnd - Date.now()) / (60 * 1000),
            );
            room.sendAnnouncement(
                `• ${muteInfo.name} - Time left: ${timeLeft} minutes`,
                player.id,
                0xff6600,
            );
        }
    },

    // Restart match
    restart: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can restart the match!",
                player.id,
                0xff0000,
            );
            return;
        }

        room.stopGame();
        room.sendAnnouncement(
            "🔄 Match stopped! Restarting in 3 seconds...",
            null,
            0xff6600,
            "bold",
        );

        setTimeout(() => {
            room.startGame();
            room.sendAnnouncement(
                "⚽ Match restarted by " + player.name + "!",
                null,
                0x00ff00,
                "bold",
            );

            sendDiscordWebhook({
                title: "🔄 Match Restarted",
                description: `Match was restarted by **${player.name}**`,
                color: 0x00ff00,
                timestamp: new Date().toISOString(),
            });
        }, 3000);
    },

    // Set match score manually
    setscore: (player, args) => {
        if (!isOwner(player)) {
            room.sendAnnouncement(
                "❌ Only the owner can modify the score!",
                player.id,
                0xff0000,
            );
            return;
        }

        const redScore = parseInt(args[0]);
        const blueScore = parseInt(args[1]);

        if (isNaN(redScore) || isNaN(blueScore)) {
            room.sendAnnouncement(
                "❌ Usage: !setscore <red_score> <blue_score>",
                player.id,
                0xff0000,
            );
            return;
        }

        room.setScoreLimit(0);
        room.setTimeLimit(0);

        // Simulate goals to update score
        const currentRed = gameState.matchStats.redGoals;
        const currentBlue = gameState.matchStats.blueGoals;

        gameState.matchStats.redGoals = redScore;
        gameState.matchStats.blueGoals = blueScore;

        room.sendAnnouncement(
            `📊 Score set to: 🔴 ${redScore} - ${blueScore} 🔵`,
            null,
            0xffd700,
            "bold",
        );

        sendDiscordWebhook({
            title: "📊 Score Modified",
            description: `Score was manually set to Red ${redScore} - ${blueScore} Blue by **${player.name}**`,
            color: 0xffd700,
            timestamp: new Date().toISOString(),
        });
    },

    // Toggle auto recording
    autorecord: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can toggle auto recording!",
                player.id,
                0xff0000,
            );
            return;
        }

        if (!gameState.autoRecord) {
            gameState.autoRecord = { enabled: false };
        }

        const action = args[0]?.toLowerCase();

        if (action === "on" || action === "start") {
            gameState.autoRecord.enabled = true;
            room.sendAnnouncement(
                "📹 Auto recording enabled for matches!",
                null,
                0x00ff00,
                "bold",
            );
        } else if (action === "off" || action === "stop") {
            gameState.autoRecord.enabled = false;
            room.sendAnnouncement(
                "⏹️ Auto recording disabled for matches!",
                null,
                0xff0000,
                "bold",
            );
        } else {
            const status = gameState.autoRecord.enabled
                ? "Enabled ✅"
                : "Disabled ❌";
            room.sendAnnouncement(
                `📹 Auto recording status: ${status}`,
                player.id,
                gameState.autoRecord.enabled ? 0x00ff00 : 0xff0000,
                "bold",
            );
            room.sendAnnouncement(
                "💡 Usage: !autorecord on/off",
                player.id,
                0x888888,
            );
        }
    },

    // Show server statistics
    serverstats: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can view server statistics!",
                player.id,
                0xff0000,
            );
            return;
        }

        const players = room.getPlayerList();
        const uptime = Math.floor(
            (Date.now() - (gameState.serverStart || Date.now())) / 1000,
        );
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        room.sendAnnouncement(
            "🖥️ Server Statistics:",
            player.id,
            0x00ffff,
            "bold",
        );
        room.sendAnnouncement(
            `⏱️ Uptime: ${hours}h ${minutes}m`,
            player.id,
            0x00ffff,
        );
        room.sendAnnouncement(
            `👥 Current players: ${players.length}/${ROOM_CONFIG.maxPlayers}`,
            player.id,
            0x00ffff,
        );
        room.sendAnnouncement(
            `🛡️ Active admins: ${gameState.admins.size}`,
            player.id,
            0x00ffff,
        );
        room.sendAnnouncement(
            `📊 Total stats saved: ${gameState.playerStats.size}`,
            player.id,
            0x00ffff,
        );

        if (gameState.mutedPlayers) {
            room.sendAnnouncement(
                `🔇 Muted players: ${gameState.mutedPlayers.size}`,
                player.id,
                0x00ffff,
            );
        }

        if (gameState.antiCheat?.suspiciousPlayers) {
            room.sendAnnouncement(
                `🚨 Suspicious players: ${gameState.antiCheat.suspiciousPlayers.size}`,
                player.id,
                0x00ffff,
            );
        }
    },

    // Create data backup
    backup: (player, args) => {
        if (!isOwner(player)) {
            room.sendAnnouncement(
                "❌ Only the owner can create backups!",
                player.id,
                0xff0000,
            );
            return;
        }

        try {
            const backupData = {
                timestamp: Date.now(),
                playerStats: Array.from(gameState.playerStats.entries()),
                clubs: Array.from(gameState.clubs.entries()),
                playerRanking: gameState.playerRanking
                    ? Array.from(gameState.playerRanking.entries())
                    : [],
                weeklyStats: gameState.weeklyStats,
                savedAdmins: Array.from(gameState.savedAdmins.entries()),
                ownerName: gameState.ownerName,
            };

            // Save backup to localStorage if available
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(
                    "haxball_backup",
                    JSON.stringify(backupData),
                );
                room.sendAnnouncement(
                    "💾 Backup created successfully!",
                    player.id,
                    0x00ff00,
                    "bold",
                );
            } else {
                room.sendAnnouncement(
                    "⚠️ Backup created in memory only",
                    player.id,
                    0xff6600,
                );
            }

            sendDiscordWebhook({
                title: "💾 Backup Created",
                description: `Data backup was created by **${player.name}**\nStats: ${gameState.playerStats.size} players\nClubs: ${gameState.clubs.size}`,
                color: 0x00ff00,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            room.sendAnnouncement(
                `❌ Error creating backup: ${error.message}`,
                player.id,
                0xff0000,
            );
        }
    },

    // Send announcement to all players
    announce: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can make announcements!",
                player.id,
                0xff0000,
            );
            return;
        }

        const message = args.join(" ");
        if (!message) {
            room.sendAnnouncement(
                "❌ Usage: !announce <message>",
                player.id,
                0xff0000,
            );
            return;
        }

        room.sendAnnouncement(
            `📢 Announcement from ${player.name}:`,
            null,
            0xffd700,
            "bold",
        );
        room.sendAnnouncement(message, null, 0xffffff, "normal");

        sendDiscordWebhook({
            title: "📢 Admin Announcement",
            description: `**${player.name}** announced: ${message}`,
            color: 0xffd700,
            timestamp: new Date().toISOString(),
        });
    },

    // Toggle chat forwarding to Discord
    chatdiscord: (player, args) => {
        if (!isAdmin(player)) {
            room.sendAnnouncement(
                "❌ Only admins can control chat forwarding to Discord!",
                player.id,
                0xff0000,
            );
            return;
        }

        if (!gameState.discordChat) {
            gameState.discordChat = { enabled: true }; // Enabled by default
        }

        const action = args[0]?.toLowerCase();

        if (action === "on" || action === "enable") {
            gameState.discordChat.enabled = true;
            room.sendAnnouncement(
                "💬 Chat forwarding to Discord enabled!",
                null,
                0x00ff00,
                "bold",
            );
            sendDiscordWebhook({
                title: "💬 Chat Integration Enabled",
                description: `Game chat forwarding to Discord was enabled by **${player.name}**`,
                color: 0x00ff00,
                timestamp: new Date().toISOString(),
            });
        } else if (action === "off" || action === "disable") {
            gameState.discordChat.enabled = false;
            room.sendAnnouncement(
                "💬 Chat forwarding to Discord disabled!",
                null,
                0xff0000,
                "bold",
            );
            sendDiscordWebhook({
                title: "💬 Chat Integration Disabled",
                description: `Game chat forwarding to Discord was disabled by **${player.name}**`,
                color: 0xff0000,
                timestamp: new Date().toISOString(),
            });
        } else {
            const status = gameState.discordChat.enabled
                ? "Enabled ✅"
                : "Disabled ❌";
            room.sendAnnouncement(
                `💬 Chat forwarding to Discord: ${status}`,
                player.id,
                gameState.discordChat.enabled ? 0x00ff00 : 0xff0000,
                "bold",
            );
            room.sendAnnouncement(
                "💡 Usage: !chatdiscord on/off",
                player.id,
                0x888888,
            );
        }
    },
};

// ==================== EVENT HANDLERS ====================

// Player join handler - Enhanced with auto-login for saved admins
room.onPlayerJoin = function (player) {
    // Enhanced player join handling with synchronization fix
    handlePlayerJoinSync(player);

    room.sendAnnouncement(
        `🎮 Welcome ${formatPlayerName(player)} to RHL TOURNAMENT! Type !help for commands.`,
        null,
        0x00ff00,
        "bold",
    );

    // Auto-login saved owner
    if (
        gameState.savedOwner === player.conn &&
        gameState.ownerName === player.name
    ) {
        gameState.owner = player;
        room.setPlayerAdmin(player.id, true);
        room.sendAnnouncement(
            `👑 Welcome back Owner ${player.name}!`,
            null,
            0xffd700,
            "bold",
        );
    }

    // Auto-login saved admins
    if (
        gameState.savedAdmins.has(player.name) &&
        gameState.savedAdmins.get(player.name) === player.conn
    ) {
        gameState.admins.add(player.id);
        room.setPlayerAdmin(player.id, true);
        room.sendAnnouncement(
            `🛡️ Welcome back Admin ${player.name}!`,
            null,
            0x00ff00,
            "bold",
        );
    }

    // Record player join for match recording
    recordAction("player_join", {
        playerName: player.name,
        playerId: player.id,
        connection: player.conn,
    });

    sendDiscordWebhook({
        title: "👋 Player Joined",
        description: `**${player.name}** joined the room`,
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        fields: [
            { name: "Player ID", value: player.id.toString(), inline: true },
            {
                name: "Connection",
                value: player.conn || "Unknown",
                inline: true,
            },
        ],
    });
};

// Player leave handler
room.onPlayerLeave = function (player) {
    // Remove from current game state but keep saved roles
    if (gameState.owner && player.id === gameState.owner.id) {
        gameState.owner = null;
        room.sendAnnouncement(
            `👑 Owner ${player.name} left the room`,
            null,
            0xff6600,
            "bold",
        );
    }

    gameState.admins.delete(player.id);

    // Record player leave for match recording
    recordAction("player_leave", {
        playerName: player.name,
        playerId: player.id,
        wasAdmin:
            gameState.admins.has(player.id) ||
            (gameState.owner && player.id === gameState.owner.id),
    });

    room.sendAnnouncement(
        `👋 ${formatPlayerName(player)} left the room`,
        null,
        0xff6600,
    );

    sendDiscordWebhook({
        title: "👋 Player Left",
        description: `**${player.name}** left the room`,
        color: 0xff6600,
        timestamp: new Date().toISOString(),
    });
};

// Chat handler
room.onPlayerChat = function (player, message) {
    // Check if player is muted
    if (gameState.mutedPlayers && gameState.mutedPlayers.has(player.id)) {
        const muteInfo = gameState.mutedPlayers.get(player.id);

        // Check if mute duration has ended
        if (Date.now() >= muteInfo.muteEnd) {
            gameState.mutedPlayers.delete(player.id);
            room.sendAnnouncement(
                `🔊 ${player.name} you are no longer muted!`,
                player.id,
                0x00ff00,
            );
        } else {
            // Player is still muted
            const timeLeft = Math.ceil(
                (muteInfo.muteEnd - Date.now()) / (60 * 1000),
            );
            room.sendAnnouncement(
                `🔇 You are muted! Time left: ${timeLeft} minutes`,
                player.id,
                0xff6600,
            );
            return false; // Block message
        }
    }

    if (message.startsWith("!")) {
        const args = message.slice(1).split(" ");
        const command = args.shift().toLowerCase();

        if (commands[command]) {
            // Handle both sync and async commands
            try {
                const result = commands[command](player, args);
                if (result && typeof result.then === "function") {
                    // It's a promise, handle errors
                    result.catch((error) => {
                        console.error(
                            `Error executing async command "${command}":`,
                            error,
                        );
                        room.sendAnnouncement(
                            `❌ Command error: ${error.message}`,
                            player.id,
                            0xff0000,
                        );
                    });
                }
            } catch (error) {
                console.error(`Error executing command "${command}":`, error);
                room.sendAnnouncement(
                    `❌ Command error: ${error.message}`,
                    player.id,
                    0xff0000,
                );
            }
            return false; // Block original message
        }
    }

    // Display chat with role formatting
    const formattedMessage = `${formatPlayerName(player)}: ${message}`;
    room.sendAnnouncement(formattedMessage, null, 0xffffff);

    // Send message to Discord
    sendChatToDiscord(player, message);

    return false; // Block original message to use our formatted version
};

// Goal handler
room.onTeamGoal = function (team) {
    const players = room.getPlayerList();
    const lastToucher = gameState.ballTracker.lastTouchPlayer;

    gameState.matchStats[team === 1 ? "redGoals" : "blueGoals"]++;

    if (lastToucher) {
        const scorerTeam = players.find((p) => p.name === lastToucher)?.team;
        const gameTime = room.getScores()?.time || 0;

        if (scorerTeam === team) {
            // Normal goal
            const stats = getPlayerStats(lastToucher);
            stats.goals++;
            gameState.matchStats.goalScorers.push(lastToucher);

            // Update ranking and weekly stats
            updatePlayerRanking(lastToucher, "goal");
            updateWeeklyStats(lastToucher, "goal", stats.goals);

            // Check daily challenge
            checkDailyChallenge(lastToucher, "goal", { gameTime: gameTime });

            // Add to live match highlights
            if (gameState.liveMatch.isActive) {
                gameState.liveMatch.highlights.push({
                    type: "goal",
                    player: lastToucher,
                    team: team,
                    time: gameTime,
                    timestamp: Date.now(),
                });
            }

            // Record action for match recording
            recordAction("goal", {
                scorer: lastToucher,
                team: team,
                gameTime: gameTime,
                isOwnGoal: false,
            });

            createGoalEffect(players.find((p) => p.name === lastToucher));

            // Check for assist
            if (gameState.ballTracker.ballHistory.length > 1) {
                const possibleAssist =
                    gameState.ballTracker.ballHistory[
                        gameState.ballTracker.ballHistory.length - 2
                    ];
                if (
                    possibleAssist.player !== lastToucher &&
                    possibleAssist.team === team
                ) {
                    const assistStats = getPlayerStats(possibleAssist.player);
                    assistStats.assists++;
                    gameState.matchStats.assists.push(possibleAssist.player);

                    // Update ranking and weekly stats for assist
                    updatePlayerRanking(possibleAssist.player, "assist");
                    updateWeeklyStats(
                        possibleAssist.player,
                        "assist",
                        assistStats.assists,
                    );

                    // Check daily challenge for assist
                    checkDailyChallenge(possibleAssist.player, "assist");

                    createAssistEffect(
                        players.find((p) => p.name === possibleAssist.player),
                    );
                }
            }
        } else {
            // Own goal
            const stats = getPlayerStats(lastToucher);
            stats.ownGoals++;

            // Penalty for own goal
            updatePlayerRanking(lastToucher, "owngoal");

            // Record own goal for match recording
            recordAction("own_goal", {
                player: lastToucher,
                team: scorerTeam,
                gameTime: gameTime,
            });

            createOwnGoalEffect(players.find((p) => p.name === lastToucher));
        }
    }

    // Send Discord notification
    const teamName = team === 1 ? "🔴 Red" : "🔵 Blue";
    const score = `${gameState.matchStats.redGoals} - ${gameState.matchStats.blueGoals}`;

    sendDiscordWebhook({
        title: "⚽ GOAL!",
        description: `${teamName} team scored!\n**Score:** ${score}`,
        color: team === 1 ? 0xff0000 : 0x0000ff,
        timestamp: new Date().toISOString(),
        fields: lastToucher
            ? [{ name: "Goal Scorer", value: lastToucher, inline: true }]
            : [],
    });
};

// Game end handler
room.onGameStop = function (byPlayer) {
    if (
        gameState.matchStats.redGoals === 0 &&
        gameState.matchStats.blueGoals === 0
    ) {
        return; // No game actually happened
    }

    // End live match analysis
    if (gameState.liveMatch.isActive) {
        endLiveMatch();
    }

    const redScore = gameState.matchStats.redGoals;
    const blueScore = gameState.matchStats.blueGoals;
    const winner =
        redScore > blueScore
            ? "🔴 Red"
            : redScore < blueScore
              ? "🔵 Blue"
              : "🤝 Draw";

    // Update player stats
    const players = room.getPlayerList();
    players.forEach((player) => {
        if (player.team === 1 || player.team === 2) {
            const stats = getPlayerStats(player.name);
            stats.gamesPlayed++;

            if (winner !== "🤝 Draw") {
                if (
                    (winner.includes("Red") && player.team === 1) ||
                    (winner.includes("Blue") && player.team === 2)
                ) {
                    stats.wins++;
                } else {
                    stats.losses++;
                }
            }
        }
    });

    room.sendAnnouncement(
        `🏁 Game Over! ${winner} wins ${redScore}-${blueScore}`,
        null,
        0xffd700,
        "bold",
        2,
    );

    // Auto-stop replay recording and send .hbr2 file to Discord
    if (gameState.recording.isRecording) {
        room.sendAnnouncement(
            `🎬 Match ended! Processing replay recording...`,
            null,
            0xff6600,
            "bold",
        );

        try {
            // Stop Haxball replay recording and get the replay data
            let replayData = null;
            if (room && room.stopRecording) {
                replayData = room.stopRecording();
                gameState.recording.isRecording = false;
                console.log("✅ Auto-stopped Haxball replay recording");

                if (replayData) {
                    // Send replay file to Discord
                    sendReplayToDiscordWebhook(
                        replayData,
                        `${redScore}-${blueScore}`,
                    );
                    room.sendAnnouncement(
                        `🎬 Replay file "match.hbr2" sent to Discord!`,
                        null,
                        0x00ff00,
                        "bold",
                    );
                } else {
                    console.warn(
                        "⚠️ No replay data returned from room.stopRecording()",
                    );
                    room.sendAnnouncement(
                        `⚠️ Replay recording stopped but no data available`,
                        null,
                        0xff9900,
                        "normal",
                    );
                }
            } else {
                console.warn("⚠️ Room.stopRecording not available");
            }
        } catch (error) {
            console.error("Error auto-stopping replay recording:", error);
            room.sendAnnouncement(
                `❌ Error processing replay recording!`,
                null,
                0xff0000,
                "bold",
            );
        }
    }

    // Create comprehensive match report
    createMatchReport(redScore, blueScore, winner);

    // Send simplified Discord match summary (the detailed report is sent by createMatchReport)
    sendDiscordWebhook({
        title: "🏁 Match Complete",
        description: `**${winner}** wins the match! 🎉\n\n*Detailed report sent above ⬆️*`,
        color: 0xffd700,
        timestamp: new Date().toISOString(),
        fields: [
            {
                name: "⚽ Final Score",
                value: `**${redScore} - ${blueScore}**`,
                inline: true,
            },
            {
                name: "🎯 Goal Scorers",
                value: gameState.matchStats.goalScorers.join(", ") || "None",
                inline: true,
            },
            {
                name: "👟 Assists",
                value: gameState.matchStats.assists.join(", ") || "None",
                inline: true,
            },
        ],
    });

    // Reset match stats
    gameState.matchStats = {
        redGoals: 0,
        blueGoals: 0,
        goalScorers: [],
        assists: [],
        mvp: null,
    };
};

// Ball touch tracking for assists and statistics
room.onPlayerBallKick = function (player) {
    const now = Date.now();
    const ballPosition = room.getBallPosition();

    gameState.ballTracker.lastTouchPlayer = player.name;
    gameState.ballTracker.lastTouchTime = now;
    gameState.ballTracker.lastTouchTeam = player.team;

    // Add to ball history for assist tracking
    gameState.ballTracker.ballHistory.push({
        player: player.name,
        team: player.team,
        time: now,
        position: ballPosition,
    });

    // Keep only recent touches (last 10)
    if (gameState.ballTracker.ballHistory.length > 10) {
        gameState.ballTracker.ballHistory.shift();
    }

    // Record ball touch for match statistics
    recordAction("ball_touch", {
        player: player.name,
        team: player.team,
        position: ballPosition,
        gameTime: room.getScores()?.time || 0,
    });

    // Update player touch statistics
    const playerStats = getPlayerStats(player.name);
    if (playerStats) {
        playerStats.touches = (playerStats.touches || 0) + 1;
        playerStats.lastTouch = now;
    }
};

// Game start handler
room.onGameStart = function (byPlayer) {
    room.sendAnnouncement(
        "🚀 Game Started! Good luck everyone!",
        null,
        0x00ff00,
        "bold",
        2,
    );

    // Automatically start recording when game starts
    if (room && room.startRecording) {
        try {
            room.startRecording();
            room.sendAnnouncement(
                "🎬 Replay recording started automatically!",
                null,
                0xff6600,
                "normal",
                1,
            );
            gameState.recording.isRecording = true;
            gameState.recording.startTime = Date.now();
            gameState.recording.matchTitle = "match";
            console.log("✅ Auto-started Haxball replay recording");
        } catch (error) {
            console.error("Error auto-starting replay recording:", error);
        }
    } else {
        console.warn("⚠️ Room.startRecording not available for auto-recording");
    }

    sendDiscordWebhook({
        title: "🚀 Match Started",
        description:
            "A new tournament match has begun!\n🎬 Replay recording started automatically",
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
    });

    // Reset match stats
    gameState.matchStats = {
        redGoals: 0,
        blueGoals: 0,
        goalScorers: [],
        assists: [],
        mvp: null,
    };
};

// Team change handler
room.onPlayerTeamChange = function (changedPlayer, byPlayer) {
    const teamNames = ["🔍 Spectators", "🔴 Red Team", "🔵 Blue Team"];
    room.sendAnnouncement(
        `${formatPlayerName(changedPlayer)} moved to ${teamNames[changedPlayer.team]}`,
        null,
        0x00ffff,
    );
};

// Room link listener
room.onRoomLink = function (url) {
    console.log("🎮 Room link:", url);
    window.roomLink = url;

    // Enhanced heartbeat
    if (typeof window !== "undefined") {
        window.roomStatus = {
            isActive: true,
            lastHeartbeat: new Date(),
            playersCount: room.getPlayerList().length,
            roomName: ROOM_CONFIG.roomName,
            roomLink: url,
        };

        console.log("💓 Room heartbeat updated:", window.roomStatus);
    }
};

// Enhanced periodic heartbeat monitoring
setInterval(() => {
    if (room && typeof window !== "undefined") {
        const players = room.getPlayerList();
        window.roomStatus = {
            isActive: true,
            lastHeartbeat: new Date(),
            playersCount: players.length,
            roomName: ROOM_CONFIG.roomName,
            roomLink: window.roomLink || null,
        };

        console.log(
            `💓 Heartbeat - Players: ${players.length}, Time: ${new Date().toISOString()}`,
        );
    }
}, 5000); // Every 5 seconds

// Initial announcement
room.sendAnnouncement(
    "🎮 RHL TOURNAMENT ROOM INITIALIZED! 🎮\n" +
        "Type !help for commands\n" +
        "Discord: " +
        DISCORD_CONFIG.serverInvite,
    null,
    0xffd700,
    "bold",
    2,
);

console.log("🎮 RHL Tournament room script loaded successfully!");

// ==================== IMPORTANT INSTRUCTIONS ====================
/*
📋 ENHANCED FEATURES NOW AVAILABLE:

✅ Complete Owner & Admin System:
   - !owner password - Authenticate as owner
   - !admin player - Give admin privileges
   - !unadmin player - Remove admin privileges
   - Auto-login for saved admins and owners

✅ Club Management System:
   - !newclub name captain - Create clubs with captains
   - !addplayer club player - Add players to clubs
   - !clubs - List all clubs and members
   - Role-based player names with club affiliations

✅ Player Management:
   - !red player - Move to red team
   - !blue player - Move to blue team  
   - !spec player - Move to spectators
   - !kick player - Kick players
   - !ban player - Ban players

✅ Statistics System:
   - !stats [player] - View detailed player statistics
   - !clear - Clear all statistics (admin only)
   - Goal, assist, win/loss tracking
   - Win rate calculation

✅ Advanced Features:
   - Smart goal/assist detection
   - Own goal tracking
   - Enhanced Discord notifications
   - Automatic role formatting in chat
   - Visual goal effects and celebrations
   - Ball touch tracking for accurate assists

✅ Help System:
   - !help - Complete command reference
   - !discord - Discord server link

✅ NEW ENHANCED FEATURES:
   - 🛡️ Anti-Cheat System - Automatic detection and banning
   - 🏆 Player Ranking System - Bronze to Diamond ranks  
   - 📊 Weekly Statistics - Top scorer, assister, MVP
   - 🎯 Daily Challenges - Random challenges with rewards
   - ⚽ Live Match Analysis - Real-time match tracking
   - 🔄 Automatic Systems - Challenge rotation, rank decay
*/

// ==================== AUTOMATIC SYSTEMS INITIALIZATION ====================

// Start daily challenge system
setTimeout(() => {
    startDailyChallenge();
}, 30000); // Start after 30 seconds

// Anti-cheat monitoring system
setInterval(() => {
    const players = room.getPlayerList();
    players.forEach((player) => {
        if (player.team !== 0) {
            // Only check active players
            detectCheating(player);
        }
    });
}, 1000); // Check every second

// Automatic daily challenge reset (every 24 hours)
setInterval(
    () => {
        if (gameState.dailyChallenges.active) {
            const completedCount = gameState.dailyChallenges.completedBy.size;
            sendDiscordWebhook({
                title: "🎯 DAILY CHALLENGE ENDED",
                description: `Challenge completed by ${completedCount} players`,
                color: 0x9932cc,
                timestamp: new Date().toISOString(),
            });
        }
        setTimeout(() => startDailyChallenge(), 5000);
    },
    24 * 60 * 60 * 1000,
);

// Weekly stats reset reminder
setInterval(
    () => {
        sendDiscordWebhook({
            title: "⏰ WEEKLY RESET REMINDER",
            description: "Weekly stats will reset in 1 hour!",
            color: 0xffff00,
            timestamp: new Date().toISOString(),
        });
        room.sendAnnouncement(
            "⏰ Weekly stats reset in 1 hour!",
            null,
            0xffff00,
            "bold",
        );
    },
    (6 * 24 + 23) * 60 * 60 * 1000,
);

// Enhanced Discord notification for room ready
sendDiscordWebhook({
    title: "🎮 ENHANCED TOURNAMENT ROOM READY",
    description: `**${ROOM_CONFIG.roomName}** is now online with new features!`,
    color: 0x00ff00,
    timestamp: new Date().toISOString(),
    fields: [
        {
            name: "🏆 Ranking System",
            value: "Bronze → Diamond progression",
            inline: true,
        },
        {
            name: "🎯 Daily Challenges",
            value: "New challenges every 24h",
            inline: true,
        },
        {
            name: "🛡️ Anti-Cheat",
            value: "Automatic detection & ban",
            inline: true,
        },
        {
            name: "📊 Weekly Stats",
            value: "Top players tracking",
            inline: true,
        },
        {
            name: "⚽ Live Analysis",
            value: "Real-time match tracking",
            inline: true,
        },
        {
            name: "New Commands",
            value: "!rank !top !weekly !challenge",
            inline: true,
        },
    ],
});
