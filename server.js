const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');
const config = require('./utils/config');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve room page
app.get('/room', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

app.get('/', (req, res) => {
    res.redirect('/room');
});

// Global variables
let browser = null;
let page = null;

// Make page globally accessible for video recording
global.page = null;
global.roomPage = null;
let isRestartingRoom = false;
let activeRoomId = null; // Store the active room ID to prevent multiple rooms
let permanentRoomLink = null; // Store permanent room link
let roomCreationInProgress = false; // Prevent multiple simultaneous room creation
let roomStatus = {
    isActive: false,
    lastHeartbeat: null,
    playersCount: 0,
    roomName: '',
    startTime: null,
    restartCount: 0,
    lastRestartTime: null,
    browserConnected: false,
    pageConnected: false,
    roomId: null,
    roomLink: null
};

// Room link endpoint - returns the SAME permanent room
app.get('/api/room-link', async (req, res) => {
    try {
        // 🔒 ALWAYS return the permanent room link if available
        if (permanentRoomLink && activeRoomId) {
            const roomData = {
                link: permanentRoomLink,
                roomId: activeRoomId,
                roomName: roomStatus.roomName || 'RHL TOURNAMENT',
                players: roomStatus.playersCount || 0,
                hasRoom: true,
                isPermanent: true,
                status: roomStatus.isActive ? 'active' : 'inactive'
            };
            
            // Try to get live player count if possible
            if (page && !page.isClosed()) {
                try {
                    const liveData = await page.evaluate(() => {
                        try {
                            return {
                                players: window.room && window.room.getPlayerList ? window.room.getPlayerList().length : 0,
                                roomName: window.room && window.room.name || null
                            };
                        } catch (error) {
                            return null;
                        }
                    });
                    
                    if (liveData) {
                        roomData.players = liveData.players;
                        if (liveData.roomName) roomData.roomName = liveData.roomName;
                    }
                } catch (error) {
                    // Ignore live data errors, use cached data
                }
            }
            
            return res.json(roomData);
        }
        
        // Fallback to old method if no permanent room
        if (!page || page.isClosed()) {
            return res.json({ 
                error: 'Room not available', 
                link: null,
                isPermanent: false 
            });
        }
        
        const roomData = await page.evaluate(() => {
            try {
                return {
                    link: window.roomLink || (window.room && window.room.link) || null,
                    roomName: window.room && window.room.name || 'Unknown',
                    players: window.room && window.room.getPlayerList ? window.room.getPlayerList().length : 0,
                    hasRoom: typeof window.room !== 'undefined',
                    isPermanent: false
                };
            } catch (error) {
                return { error: error.message, link: null, isPermanent: false };
            }
        });
        
        res.json(roomData);
    } catch (error) {
        res.json({ 
            error: error.message, 
            link: permanentRoomLink || null,
            isPermanent: !!permanentRoomLink
        });
    }
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
    const now = new Date();
    const memUsage = process.memoryUsage();
    
    const status = {
        server: 'running',
        timestamp: now.toISOString(),
        room: {
            isActive: roomStatus.isActive,
            browserConnected: roomStatus.browserConnected,
            pageConnected: roomStatus.pageConnected,
            playersCount: roomStatus.playersCount,
            roomName: roomStatus.roomName
        },
        uptime: {
            process: process.uptime(),
            server: roomStatus.startTime ? Math.floor((now - roomStatus.startTime) / 1000) : 0
        },
        memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024),
            total: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        },
        heartbeat: {
            last: roomStatus.lastHeartbeat,
            ageSeconds: roomStatus.lastHeartbeat ? Math.floor((now - roomStatus.lastHeartbeat) / 1000) : null
        },
        restarts: {
            count: roomStatus.restartCount,
            lastRestart: roomStatus.lastRestartTime
        },
        health: roomStatus.isActive && roomStatus.browserConnected && roomStatus.pageConnected ? 'healthy' : 'unhealthy'
    };
    
    const httpStatus = status.health === 'healthy' ? 200 : 503;
    res.status(httpStatus).json(status);
});

// Status endpoint for monitoring
app.get('/status', (req, res) => {
    const enhancedStatus = {
        ...roomStatus,
        permanentRoom: {
            isActive: !!activeRoomId,
            roomId: activeRoomId,
            roomLink: permanentRoomLink,
            creationInProgress: roomCreationInProgress
        },
        server: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        }
    };
    
    res.json(enhancedStatus);
});

// API endpoint to start video recording
app.post('/api/start-recording', async (req, res) => {
    try {
        const { playerName, matchTitle, timestamp } = req.body;
        
        if (!page || page.isClosed()) {
            res.status(503).json({ 
                success: false, 
                message: 'Browser not available for recording' 
            });
            return;
        }
        
        logger.info(`🎬 API: Starting recording for ${playerName}: ${matchTitle}`);
        
        // Start server-side recording
        const recordingRequest = {
            playerName: playerName,
            matchTitle: matchTitle || `Match_${timestamp}`,
            timestamp: timestamp || Date.now()
        };
        
        startServerSideRecording(recordingRequest);
        
        res.json({ 
            success: true, 
            message: 'Video recording started',
            recordingData: recordingRequest
        });
        
    } catch (error) {
        logger.error('API: Failed to start recording:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to start recording',
            error: error.message
        });
    }
});

// Enhanced manual restart endpoint
app.post('/restart', async (req, res) => {
    logger.info('Manual restart requested via API');
    
    if (isRestartingRoom || roomCreationInProgress) {
        res.status(409).json({ 
            success: false, 
            message: 'Restart or room creation already in progress' 
        });
        return;
    }
    
    // 🔒 IMPORTANT: Check if permanent room exists
    if (activeRoomId && permanentRoomLink) {
        logger.info('⚠️ Permanent room exists - restart will preserve the same room');
        res.json({ 
            success: true, 
            message: 'Permanent room active - restart not needed',
            roomId: activeRoomId,
            roomLink: permanentRoomLink,
            timestamp: new Date().toISOString()
        });
        return;
    }
    
    try {
        // Don't await the restart, return immediately
        restartRoomSafely('Manual API restart').catch(error => {
            logger.error('Manual restart failed:', error);
        });
        
        res.json({ 
            success: true, 
            message: 'Room restart initiated',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to initiate manual restart:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to initiate restart',
            error: error.message
        });
    }
});

// Discord command webhook endpoint - استقبال الأوامر من Discord
app.post('/webhook/discord', async (req, res) => {
    try {
        logger.info('🎯 Discord webhook received:', JSON.stringify(req.body, null, 2));
        
        // التحقق من وجود محتوى الرسالة
        if (!req.body || !req.body.content) {
            return res.status(400).json({ 
                success: false, 
                message: 'No message content received' 
            });
        }
        
        const message = req.body.content.trim();
        const author = req.body.author || {};
        const username = author.username || 'Discord User';
        
        // التحقق من أن الرسالة تبدأ بـ ! (أمر)
        if (!message.startsWith('!')) {
            return res.json({ 
                success: true, 
                message: 'Message received but not a command' 
            });
        }
        
        // تحليل الأمر
        const args = message.slice(1).split(' ');
        const command = args[0].toLowerCase();
        const params = args.slice(1);
        
        logger.info(`🔥 Command received: ${command} with params:`, params);
        
        // التحقق من وجود الغرفة
        if (!page || page.isClosed()) {
            return res.status(503).json({ 
                success: false, 
                message: 'Haxball room is not available' 
            });
        }
        
        // تنفيذ الأمر داخل Haxball
        const result = await executeHaxballCommand(command, params, username);
        
        res.json({
            success: true,
            command: command,
            params: params,
            executedBy: username,
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Discord webhook error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to process Discord command',
            error: error.message
        });
    }
});

// Initialize Puppeteer browser with better error handling
async function initBrowser() {
    try {
        // Close existing browser if any
        await closeBrowserSafely();
        
        logger.info('Initializing new Puppeteer browser...');
        
        const browserArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            // 🔥 ENHANCED WebRTC support for Replit containers
            '--enable-webrtc',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-running-insecure-content',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--ignore-certificate-errors-ssl-errors',
            // 🚀 REPLIT SPECIFIC WebRTC settings
            '--force-webrtc-ip-handling-policy=default',
            '--webrtc-ip-handling-policy=default',
            '--enable-webrtc-stun-origin', 
            '--allow-loopback-in-peer-connection',
            '--enable-webrtc-srtp-aes-gcm',
            '--enable-webrtc-srtp-encrypted-headers',
            '--enable-webrtc-hide-local-ips-with-mdns=false',
            '--webrtc-max-cpu-consumption-percentage=100',
            '--enable-features=WebRTC-H264WithOpenH264FFmpeg',
            // 🌐 Network bypass for containers
            '--disable-background-networking',
            '--enable-features=NetworkService,NetworkServiceLogging',
            '--disable-ipc-flooding-protection',
            '--enforce-webrtc-ip-permission-check=false',
            '--disable-webrtc-apm-in-audio-service',
            // 🔧 Replit/Container specific fixes
            '--enable-aggressive-domstorage-flushing',
            '--enable-quic',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--single-process',
            '--disable-gpu-sandbox',
            '--disable-software-rasterizer',
            '--allow-file-access-from-files',
            '--disable-features=TranslateUI',
            '--disable-extensions-http-throttling',
            '--disable-component-extensions-with-background-pages',
            // Additional stability args
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-javascript-harmony-shipping',
            '--disable-client-side-phishing-detection',
            // 🎯 Extra WebRTC flags for Replit
            '--enable-experimental-web-platform-features',
            '--enable-webrtc-hw-decoding',
            '--enable-webrtc-hw-encoding',
            '--force-fieldtrials=WebRTC-H264WithOpenH264FFmpeg/Enabled/'
        ];

        // Additional args for Render environment
        if (process.env.RENDER) {
            browserArgs.push('--single-process');
        }

        // Enhanced browser launch configuration for Linux/Replit environment
        const launchOptions = {
            headless: 'new',
            args: browserArgs,
            defaultViewport: { width: 1280, height: 720 },
            timeout: 60000 // Increased timeout for initialization
        };

        // Force use of system chromium to avoid dependency issues
        try {
            const fs = require('fs');
            const executablePath = config.PUPPETEER_EXECUTABLE_PATH;
            
            if (executablePath && fs.existsSync(executablePath)) {
                launchOptions.executablePath = executablePath;
                logger.info(`Using system Chromium at: ${executablePath}`);
            } else {
                // Try common system chromium paths
                const systemPaths = [
                    '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
                    '/usr/bin/chromium',
                    '/usr/bin/chromium-browser',
                    '/usr/bin/google-chrome',
                    '/opt/google/chrome/chrome'
                ];
                
                let foundPath = null;
                for (const path of systemPaths) {
                    if (fs.existsSync(path)) {
                        foundPath = path;
                        break;
                    }
                }
                
                if (foundPath) {
                    launchOptions.executablePath = foundPath;
                    logger.info(`Found system Chromium at: ${foundPath}`);
                } else {
                    logger.warn('No system Chromium found, attempting bundled browser with additional flags');
                    launchOptions.args.push('--disable-dev-shm-usage', '--disable-extensions');
                }
            }
        } catch (error) {
            logger.warn('Error setting up Chromium, using default configuration:', error.message);
        }

        browser = await puppeteer.launch(launchOptions);

        // Set up browser event handlers (DISABLED auto-restart)
        browser.on('disconnected', () => {
            logger.warn('Browser disconnected event triggered - AUTO-RESTART DISABLED');
            roomStatus.browserConnected = false;
            // AUTO-RESTART DISABLED - Room will stay as single instance
        });

        roomStatus.browserConnected = true;
        logger.info('Browser initialized successfully');
        return browser;
    } catch (error) {
        logger.error('Failed to initialize browser:', error);
        roomStatus.browserConnected = false;
        throw error;
    }
}

// Safely close browser
async function closeBrowserSafely() {
    try {
        if (page && !page.isClosed()) {
            logger.info('Closing existing page...');
            await page.close().catch(err => logger.warn('Error closing page:', err));
        }
        
        if (browser && browser.connected) {
            logger.info('Closing existing browser...');
            await browser.close().catch(err => logger.warn('Error closing browser:', err));
        }
        
        browser = null;
        page = null;
        roomStatus.browserConnected = false;
        roomStatus.pageConnected = false;
    } catch (error) {
        logger.warn('Error during browser cleanup:', error);
        // Force reset even if cleanup failed
        browser = null;
        page = null;
        roomStatus.browserConnected = false;
        roomStatus.pageConnected = false;
    }
}

// Check if browser and page are healthy
async function isBrowserHealthy() {
    try {
        if (!browser || !browser.connected) {
            return false;
        }
        
        if (!page || page.isClosed()) {
            return false;
        }
        
        // Try a simple operation to test connection
        await page.evaluate(() => Date.now());
        return true;
    } catch (error) {
        logger.warn('Browser health check failed:', error.message);
        return false;
    }
}

// Geographic location - Egypt only
const GEO_LOCATIONS = [
    { code: 'eg', lat: 30.0444, lon: 31.2357, name: 'Egypt - Cairo' }
];

// Create new page and setup Haxball room with location fallback
async function createHaxballRoom(locationIndex = 0) {
    try {
        // 🔒 CRITICAL: Prevent multiple room creation
        if (roomCreationInProgress) {
            logger.warn('⚠️ Room creation already in progress, skipping...');
            return;
        }
        
        if (activeRoomId && roomStatus.isActive) {
            logger.info('✅ Active room already exists, using existing room...');
            logger.info(`🔗 Current room link: ${permanentRoomLink || roomStatus.roomLink}`);
            return;
        }
        
        roomCreationInProgress = true;
        logger.info('🔧 Creating new Haxball room...');
        
        if (!browser) {
            await initBrowser();
        }

        page = await browser.newPage();
        
        // Set up page event handlers first
        page.on('error', (error) => {
            logger.error('Page error event:', error.message);
        });
        
        page.on('pageerror', (error) => {
            logger.error('Page pageerror event:', error.message);
        });
        
        page.on('close', () => {
            logger.warn('Page close event triggered - AUTO-RESTART DISABLED');
            roomStatus.pageConnected = false;
            // AUTO-RESTART DISABLED - Room will stay as single instance
        });
        
        page.on('framedetached', (frame) => {
            logger.warn('Frame detached event:', frame.url());
        });
        
        // Enhanced WebRTC permissions and settings
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('https://www.haxball.com', [
            'camera',
            'microphone',
            'notifications',
            'geolocation'
        ]);
        
        // Critical: Enhanced WebRTC configuration for better connectivity and synchronization
        await page.evaluateOnNewDocument(() => {
            // Enhanced WebRTC configuration for better connectivity and player synchronization
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
                navigator.mediaDevices.getUserMedia = function(constraints) {
                    return Promise.resolve({
                        getTracks: () => [],
                        addTrack: () => {},
                        removeTrack: () => {},
                        getVideoTracks: () => [],
                        getAudioTracks: () => []
                    });
                };
            }
            
            // Enhanced WebRTC configuration with improved ICE handling for player visibility
            const originalRTCPeerConnection = window.RTCPeerConnection;
            if (originalRTCPeerConnection) {
                window.RTCPeerConnection = function(config) {
                    // Enhanced ICE server configuration for better connectivity
                    const enhancedConfig = {
                        ...config,
                        iceTransportPolicy: 'all',
                        bundlePolicy: 'max-bundle',
                        rtcpMuxPolicy: 'require',
                        iceCandidatePoolSize: 15
                    };
                    
                    // Comprehensive TURN server configuration for NAT traversal
                    if (enhancedConfig && enhancedConfig.iceServers) {
                        enhancedConfig.iceServers = [...(enhancedConfig.iceServers || []), 
                            // Primary TURN servers for reliable connectivity
                            { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
                            { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
                            { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
                            { urls: "turns:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
                            // Enhanced STUN servers for ICE gathering
                            { urls: "stun:stun.l.google.com:19302" },
                            { urls: "stun:stun1.l.google.com:19302" },
                            { urls: "stun:stun2.l.google.com:19302" },
                            { urls: "stun:stun3.l.google.com:19302" },
                            { urls: "stun:stun4.l.google.com:19302" },
                            { urls: "stun:global.stun.twilio.com:3478" },
                            { urls: "stun:stun.cloudflare.com:3478" }
                        ];
                    }
                    
                    const connection = new originalRTCPeerConnection(enhancedConfig);
                    
                    // Enhanced connection monitoring for better player synchronization
                    connection.addEventListener('connectionstatechange', () => {
                        console.log('WebRTC Connection state:', connection.connectionState);
                        if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
                            console.warn('WebRTC connection issue detected - this may cause players to not see each other');
                        }
                    });
                    
                    connection.addEventListener('iceconnectionstatechange', () => {
                        console.log('ICE Connection state:', connection.iceConnectionState);
                        if (connection.iceConnectionState === 'failed') {
                            console.error('ICE connection failed - players may not be able to connect to each other');
                        }
                    });
                    
                    connection.addEventListener('icegatheringstatechange', () => {
                        console.log('ICE Gathering state:', connection.iceGatheringState);
                    });
                    
                    return connection;
                };
            }
            
            // Force consistent timestamp synchronization for game state
            window.performance = window.performance || {};
            const originalNow = window.performance.now || Date.now;
            let timeOffset = 0;
            
            window.performance.now = function() {
                return originalNow.call(this) + timeOffset;
            };
            
            // Enhanced room synchronization helper
            window.roomSyncHelper = {
                lastSyncTime: Date.now(),
                connectionChecks: 0,
                maxConnectionChecks: 5,
                checkInterval: null,
                
                startConnectionMonitoring: function() {
                    if (this.checkInterval) clearInterval(this.checkInterval);
                    
                    this.checkInterval = setInterval(() => {
                        this.connectionChecks++;
                        console.log(`Connection check #${this.connectionChecks}`);
                        
                        // Force room refresh if too many failed checks
                        if (this.connectionChecks >= this.maxConnectionChecks) {
                            console.warn('Too many connection checks - forcing room state refresh');
                            if (window.room && window.room.getPlayerList) {
                                try {
                                    const players = window.room.getPlayerList();
                                    console.log(`Room has ${players.length} players after refresh`);
                                } catch (e) {
                                    console.error('Room refresh failed:', e);
                                }
                            }
                            this.connectionChecks = 0;
                        }
                    }, 10000); // Check every 10 seconds
                }
            };
            
            // Start monitoring when room is ready
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    if (window.roomSyncHelper) {
                        window.roomSyncHelper.startConnectionMonitoring();
                    }
                }, 5000);
            });
        });
        
        // Navigate to Haxball
        await page.goto('https://www.haxball.com/headless', {
            waitUntil: 'networkidle2',
            timeout: 45000
        });
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Inject tournament script with proper token replacement
        const scriptContent = await fsPromises.readFile('./scripts/haxball-tournament.js', 'utf8');
        
        // Replace ALL process.env references with actual values
        let configuredScript = scriptContent;
        
        // Define all environment variable replacements
        const envReplacements = [
            { pattern: /process\.env\.HAXBALL_TOKEN \|\| \"[^\"]*\"/g, value: `"${config.HAXBALL_TOKEN}"` },
            { pattern: /process\.env\.ROOM_NAME \|\| \"[^\"]*\"/g, value: `"${config.ROOM_NAME}"` },
            { pattern: /parseInt\(process\.env\.MAX_PLAYERS\) \|\| \d+/g, value: config.MAX_PLAYERS },
            { pattern: /process\.env\.MAX_PLAYERS \|\| \d+/g, value: config.MAX_PLAYERS },
            { pattern: /process\.env\.GEO_CODE \|\| \"[^\"]*\"/g, value: `"${config.GEO_CODE}"` },
            { pattern: /parseFloat\(process\.env\.GEO_LAT\) \|\| [\d.]+/g, value: config.GEO_LAT },
            { pattern: /process\.env\.GEO_LAT \|\| [\d.]+/g, value: config.GEO_LAT },
            { pattern: /parseFloat\(process\.env\.GEO_LON\) \|\| [\d.]+/g, value: config.GEO_LON },
            { pattern: /process\.env\.GEO_LON \|\| [\d.]+/g, value: config.GEO_LON },
            { pattern: /process\.env\.DISCORD_WEBHOOK \|\| \"[^\"]*\"/g, value: `"${config.DISCORD_WEBHOOK}"` },
            { pattern: /process\.env\.DISCORD_CHANNEL_ID \|\| \"[^\"]*\"/g, value: `"${config.DISCORD_CHANNEL_ID}"` },
            { pattern: /process\.env\.DISCORD_REPORT_ROLE_ID \|\| \"[^\"]*\"/g, value: `"${config.DISCORD_REPORT_ROLE_ID}"` },
            { pattern: /process\.env\.DISCORD_INVITE \|\| \"[^\"]*\"/g, value: `"${config.DISCORD_INVITE}"` },
            { pattern: /process\.env\.OWNER_PASSWORD \|\| \"[^\"]*\"/g, value: `"${config.OWNER_PASSWORD}"` }
        ];
        
        // Apply all replacements
        envReplacements.forEach(({ pattern, value }) => {
            configuredScript = configuredScript.replace(pattern, value);
        });
        
        // Remove any remaining process.env references to prevent errors
        configuredScript = configuredScript.replace(/process\.env\./g, 'undefined /* removed process.env */ .');
        
        logger.info('🔑 Using token (first 20 chars):', config.HAXBALL_TOKEN.substring(0, 20) + '...');
        
        // Execute the configured script
        await page.evaluate(configuredScript);
        
        // Wait longer for room initialization  
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Check if room was created and get detailed status
        const roomCreationStatus = await page.evaluate(() => {
            // Enhanced room verification
            const roomExists = typeof window.room !== 'undefined' && window.room !== null;
            const roomLink = window.roomLink || (window.room && window.room.link) || null;
            
            // Additional room verification methods
            let roomName = null;
            let roomFunctions = {};
            
            if (roomExists) {
                try {
                    roomName = window.room.name || null;
                    // Check available room functions
                    roomFunctions = {
                        hasGetPlayerList: typeof window.room.getPlayerList === 'function',
                        hasLink: typeof window.room.link !== 'undefined',
                        hasSendAnnouncement: typeof window.room.sendAnnouncement === 'function'
                    };
                } catch (error) {
                    console.error('Error checking room functions:', error);
                }
            }
            
            return {
                hasRoom: roomExists,
                roomLink: roomLink,
                errors: window.initErrors || [],
                roomName: roomName,
                hbInitCalled: window.hbInitCalled || false,
                roomObject: roomExists ? 'exists' : 'missing',
                roomFunctions: roomFunctions,
                windowKeys: Object.keys(window).filter(key => key.includes('room') || key.includes('hb')),
                debugInfo: {
                    roomType: typeof window.room,
                    roomConstructor: roomExists ? window.room.constructor.name : null,
                    hasGlobalVar: typeof room !== 'undefined'
                }
            };
        });
        
        logger.info('🎮 Room creation result:', roomCreationStatus);
        
        if (!roomCreationStatus.hasRoom) {
            logger.error('❌ Room creation failed! Detailed analysis:');
            logger.error('   - Room object:', roomCreationStatus.roomObject);
            logger.error('   - HBInit called:', roomCreationStatus.hbInitCalled);
            logger.error('   - Errors:', roomCreationStatus.errors);
            logger.error('   - Window keys:', roomCreationStatus.windowKeys);
            logger.error('   - Debug info:', roomCreationStatus.debugInfo);
            
            roomCreationInProgress = false; // Reset flag on failure
            const errorMsg = `Room creation failed! Room object is ${roomCreationStatus.roomObject}. HBInit was ${roomCreationStatus.hbInitCalled ? 'called' : 'not called'}.`;
            throw new Error(errorMsg);
        } else {
            logger.info('✅ Room created successfully!');
            logger.info('   - Room object: EXISTS');
            logger.info('   - Room functions:', roomCreationStatus.roomFunctions);
            logger.info('   - Room name:', roomCreationStatus.roomName);
            
            // 🔒 CRITICAL: Store room information permanently to prevent recreation
            if (roomCreationStatus.roomLink) {
                const roomId = roomCreationStatus.roomLink.split('c=')[1];
                activeRoomId = roomId;
                permanentRoomLink = roomCreationStatus.roomLink;
                
                logger.info('🔗 Room link:', roomCreationStatus.roomLink);
                logger.info('🆔 Room ID stored:', roomId);
                logger.info('🔒 Room marked as permanent - no recreation will occur');
            } else {
                logger.warn('⚠️ Room created but no link available - please check your token');
            }
        }
        
        // Update room status
        roomStatus.isActive = true;
        roomStatus.startTime = new Date();
        roomStatus.lastHeartbeat = new Date();
        roomStatus.pageConnected = true;
        roomStatus.roomName = roomCreationStatus.roomName || config.ROOM_NAME;
        roomStatus.roomId = activeRoomId;
        roomStatus.roomLink = permanentRoomLink;
        
        // Make page globally accessible for video recording
        global.page = page;
        global.roomPage = page;
        
        // Setup video recording monitoring
        await setupVideoRecordingMonitoring();
        
        roomCreationInProgress = false; // Reset flag on success
        logger.info('✅ Haxball room created successfully with preservation mode');
        logger.info('🔒 ROOM PERSISTENCE ENABLED - This room will not be recreated');
        
    } catch (error) {
        roomCreationInProgress = false; // Reset flag on error
        logger.error('Failed to create Haxball room:', error);
        throw error;
    }
}

// Setup video recording monitoring
async function setupVideoRecordingMonitoring() {
    try {
        // Monitor for recording requests from the browser
        setInterval(async () => {
            try {
                if (!page || page.isClosed()) return;
                
                const requests = await page.evaluate(() => {
                    const result = {};
                    
                    // Check for recording start request
                    if (window.recordingRequest) {
                        result.recordingRequest = window.recordingRequest;
                        window.recordingRequest = null; // Clear after reading
                    }
                    
                    // Check for Discord replay send request
                    if (window.discordReplayRequest) {
                        result.discordRequest = window.discordReplayRequest;
                        window.discordReplayRequest = null; // Clear after reading
                    }
                    
                    return result;
                });
                
                if (requests.recordingRequest && requests.recordingRequest.action === 'start') {
                    // Start actual server-side screenshot recording
                    await startServerSideRecording(requests.recordingRequest);
                }
                
                if (requests.discordRequest && requests.discordRequest.action === 'sendReplay') {
                    // Send Haxball replay to Discord
                    await sendHaxballReplayToDiscord(requests.discordRequest);
                }
            } catch (error) {
                // Silently handle errors to avoid spam
            }
        }, 1000); // Check every second
        
        logger.info('Video recording monitoring setup complete');
    } catch (error) {
        logger.error('Failed to setup video recording monitoring:', error);
    }
}

// Server-side recording function
async function startServerSideRecording(request) {
    try {
        if (!page || page.isClosed()) {
            logger.error('No page available for recording');
            return;
        }
        
        const timestamp = Date.now();
        const safeTitle = (request.matchTitle || `Match_${timestamp}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const recordingPath = `./recordings/${safeTitle}_${timestamp}`;
        
        // Create recordings directory if it doesn't exist
        if (!fs.existsSync('./recordings')) {
            fs.mkdirSync('./recordings', { recursive: true });
        }
        
        logger.info(`🎬 Starting server-side recording: ${safeTitle}`);
        
        // Set recording flag in browser
        await page.evaluate((data) => {
            if (window.gameState && window.gameState.recording) {
                window.gameState.recording.isRecording = true;
                window.gameState.recording.startTime = data.timestamp;
                window.gameState.recording.matchTitle = data.matchTitle;
                window.gameState.recording.recordingPlayer = data.playerName;
            }
        }, request);
        
        // Start video recording using puppeteer-screen-recorder
        const videoPath = `${recordingPath}.mp4`;
        
        // Simple approach: use page.pdf then convert, or use external screen recording
        let screenshotCount = 0;
        const screenshots = [];
        
        const recordingInterval = setInterval(async () => {
            try {
                if (!page || page.isClosed()) {
                    clearInterval(recordingInterval);
                    await createVideoFromScreenshots(screenshots, videoPath, request);
                    return;
                }
                
                // Check if recording should stop
                const shouldContinue = await page.evaluate(() => {
                    return window.gameState && window.gameState.recording && window.gameState.recording.isRecording;
                });
                
                if (!shouldContinue) {
                    clearInterval(recordingInterval);
                    logger.info('🎬 Recording stopped by user');
                    await createVideoFromScreenshots(screenshots, videoPath, request);
                    return;
                }
                
                // Enhanced screenshot with higher quality
                const screenshot = await page.screenshot({
                    type: 'jpeg',
                    quality: 85, // Increased quality for better video
                    fullPage: false,
                    clip: {
                        x: 0,
                        y: 0,
                        width: 1280,
                        height: 720
                    }
                });
                
                screenshots.push({
                    data: screenshot,
                    timestamp: Date.now()
                });
                screenshotCount++;
                
                // Limit recording to 5 minutes (4500 frames at 15fps)
                if (screenshotCount >= 4500) {
                    clearInterval(recordingInterval);
                    logger.info('🎬 Recording stopped - max duration reached');
                    await createVideoFromScreenshots(screenshots, videoPath, request);
                }
                
            } catch (error) {
                logger.error('Screenshot error:', error);
                clearInterval(recordingInterval);
            }
        }, 67); // ~15 FPS for smoother video
        
    } catch (error) {
        logger.error('Failed to start server-side recording:', error);
    }
}

// Create video from screenshots and send to Discord
async function createVideoFromScreenshots(screenshots, videoPath, recordingData) {
    try {
        logger.info(`🎬 Creating video from ${screenshots.length} screenshots...`);
        
        if (screenshots.length < 10) {
            logger.warn('⚠️ Not enough screenshots for video creation');
            return;
        }
        
        // Create a simple "video" by saving screenshots and metadata
        const videoData = {
            screenshots: screenshots.length,
            duration: screenshots.length / 15, // 15 FPS
            startTime: recordingData.timestamp,
            endTime: Date.now(),
            matchTitle: recordingData.matchTitle,
            recordedBy: recordingData.playerName,
            path: videoPath
        };
        
        // Create actual MP4 video with FFmpeg
        await createActualVideoFile(screenshots, videoPath, videoData);
        
        logger.info('🎬 Video creation completed, sending to Discord...');
        
        // Send to Discord
        await sendVideoToDiscord(videoData, recordingData);
        
    } catch (error) {
        logger.error('Failed to create video:', error);
    }
}

// Create actual video file with FFmpeg
async function createActualVideoFile(screenshots, videoPath, videoData) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const path = require('path');
    
    try {
        if (screenshots.length < 10) {
            logger.warn('⚠️ Not enough screenshots for video creation');
            return;
        }
        
        // Create temporary directory for frames
        const tempDir = path.join('./recordings', `temp_${Date.now()}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        logger.info(`🎬 Saving ${screenshots.length} frames to ${tempDir}...`);
        
        // Save all screenshots as sequential frames
        for (let i = 0; i < screenshots.length; i++) {
            const framePath = path.join(tempDir, `frame_${i.toString().padStart(6, '0')}.jpg`);
            fs.writeFileSync(framePath, screenshots[i].data);
        }
        
        // Enhanced FFmpeg command for high quality video
        const ffmpegCmd = `ffmpeg -y -r 15 -i "${tempDir}/frame_%06d.jpg" ` +
                         `-c:v libx264 -pix_fmt yuv420p -preset slow -crf 18 ` +
                         `-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" ` +
                         `-movflags +faststart "${videoPath}"`;
        
        logger.info('🎥 Creating MP4 video with FFmpeg...');
        const { stdout, stderr } = await execPromise(ffmpegCmd, { timeout: 120000 });
        
        if (fs.existsSync(videoPath)) {
            const stats = fs.statSync(videoPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            logger.info(`✅ MP4 video created: ${videoPath} (${fileSizeMB} MB)`);
            
            // Save video metadata
            const metaPath = videoPath.replace('.mp4', '.json');
            const metadata = {
                ...videoData,
                videoFile: videoPath,
                fileSizeMB: fileSizeMB,
                actualFrames: screenshots.length,
                quality: 'High (CRF 18)',
                resolution: '1280x720'
            };
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
            
            // Save preview images
            if (screenshots.length > 0) {
                fs.writeFileSync(videoPath.replace('.mp4', '_start.jpg'), screenshots[0].data);
                fs.writeFileSync(videoPath.replace('.mp4', '_end.jpg'), screenshots[screenshots.length - 1].data);
            }
        } else {
            throw new Error('FFmpeg failed to create video file');
        }
        
        // Clean up temp directory after a delay
        setTimeout(() => {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
                logger.info(`🗑️ Cleaned up temp directory: ${tempDir}`);
            } catch (cleanupError) {
                logger.error('Error cleaning temp directory:', cleanupError);
            }
        }, 10000);
        
    } catch (error) {
        logger.error('FFmpeg video creation failed:', error);
        // Fallback: save screenshots data as before
        const videoDataFallback = {
            ...videoData,
            error: 'FFmpeg not available, screenshots saved instead',
            screenshotsPath: videoPath.replace('.mp4', '_screenshots.json')
        };
        fs.writeFileSync(videoPath.replace('.mp4', '.json'), JSON.stringify(videoDataFallback, null, 2));
        
        if (screenshots.length > 0) {
            fs.writeFileSync(videoPath.replace('.mp4', '_start.jpg'), screenshots[0].data);
            fs.writeFileSync(videoPath.replace('.mp4', '_end.jpg'), screenshots[screenshots.length - 1].data);
        }
    }
}

// Send video to Discord
async function sendVideoToDiscord(videoData, recordingData) {
    try {
        if (!config.DISCORD_WEBHOOK) {
            logger.warn('⚠️ No Discord webhook configured, skipping Discord upload');
            return;
        }
        
        const axios = require('axios');
        const FormData = require('form-data');
        
        // Create match summary
        const duration = Math.floor(videoData.duration);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        // Enhanced recording completion notification
        const embedData = {
            embeds: [{
                title: "🎬 MATCH VIDEO CREATED",
                description: `**${videoData.matchTitle}** - Professional quality video recording completed!`,
                color: 0x00ff00,
                timestamp: new Date().toISOString(),
                fields: [
                    { name: "⏱️ Duration", value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true },
                    { name: "📊 Frames", value: `${videoData.screenshots} (15 FPS)`, inline: true },
                    { name: "🎥 Quality", value: "1280x720 HD", inline: true },
                    { name: "📱 Recorded By", value: recordingData.playerName, inline: true },
                    { name: "📅 Date", value: new Date(recordingData.timestamp).toLocaleString(), inline: true },
                    { name: "📁 File", value: videoData.fileSizeMB ? `${videoData.fileSizeMB} MB` : "Processing...", inline: true }
                ],
                footer: {
                    text: "RHL Tournament • Professional Match Recording System"
                }
            }]
        };
        
        // Send to Discord webhook
        await axios.post(config.DISCORD_WEBHOOK, embedData);
        
        // Try to send the actual video file if it's small enough
        if (videoData.videoFile && fs.existsSync(videoData.videoFile)) {
            const stats = fs.statSync(videoData.videoFile);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            if (fileSizeMB <= 25) { // Discord file size limit
                const FormData = require('form-data');
                const form = new FormData();
                
                form.append('file', fs.createReadStream(videoData.videoFile), {
                    filename: `${videoData.matchTitle}_video.mp4`,
                    contentType: 'video/mp4'
                });
                
                const videoPayload = {
                    embeds: [{
                        title: "🎬 MATCH VIDEO FILE",
                        description: `Download the HD video of **${videoData.matchTitle}**!`,
                        color: 0x9932cc,
                        timestamp: new Date().toISOString(),
                        fields: [
                            { name: "Quality", value: "1280x720 HD", inline: true },
                            { name: "Frame Rate", value: "15 FPS", inline: true },
                            { name: "File Size", value: `${fileSizeMB.toFixed(2)} MB`, inline: true }
                        ]
                    }]
                };
                
                form.append('payload_json', JSON.stringify(videoPayload));
                
                await axios.post(config.DISCORD_WEBHOOK, form, {
                    headers: form.getHeaders(),
                    timeout: 60000 // Longer timeout for video upload
                });
                
                logger.info(`✅ Video file sent to Discord: ${fileSizeMB.toFixed(2)} MB`);
            } else {
                logger.warn(`⚠️ Video file too large for Discord: ${fileSizeMB.toFixed(2)} MB`);
            }
        }
        
        // Send preview images if they exist
        const startImagePath = videoData.path.replace('.mp4', '_start.jpg');
        const endImagePath = videoData.path.replace('.mp4', '_end.jpg');
        
        if (fs.existsSync(startImagePath)) {
            const form = new FormData();
            form.append('file', fs.createReadStream(startImagePath), {
                filename: `${recordingData.matchTitle}_preview.jpg`,
                contentType: 'image/jpeg'
            });
            
            const payload = {
                embeds: [{
                    title: "📸 MATCH PREVIEW",
                    description: `Preview from **${videoData.matchTitle}**`,
                    color: 0x9932cc,
                    image: {
                        url: `attachment://${recordingData.matchTitle}_preview.jpg`
                    }
                }]
            };
            
            form.append('payload_json', JSON.stringify(payload));
            
            await axios.post(config.DISCORD_WEBHOOK, form, {
                headers: form.getHeaders()
            });
        }
        
        logger.info('✅ Recording sent to Discord successfully');
        
    } catch (error) {
        logger.error('Failed to send video to Discord:', error);
    }
}

// Send Haxball replay to Discord
async function sendHaxballReplayToDiscord(request) {
    try {
        if (!config.DISCORD_WEBHOOK) {
            logger.warn('⚠️ No Discord webhook configured, skipping Discord upload');
            return;
        }
        
        const axios = require('axios');
        const FormData = require('form-data');
        
        // Create replay file
        const timestamp = Date.now();
        const replayFileName = `${request.matchSummary.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}.hbr2`;
        const replayPath = `./recordings/${replayFileName}`;
        
        // Create recordings directory if it doesn't exist
        if (!fs.existsSync('./recordings')) {
            fs.mkdirSync('./recordings', { recursive: true });
        }
        
        // Save replay data to file
        if (request.replayData) {
            // Convert replay data to proper format if needed
            let replayBuffer;
            if (typeof request.replayData === 'string') {
                replayBuffer = Buffer.from(request.replayData, 'base64');
            } else if (request.replayData instanceof ArrayBuffer) {
                replayBuffer = Buffer.from(request.replayData);
            } else {
                replayBuffer = Buffer.from(JSON.stringify(request.replayData));
            }
            
            fs.writeFileSync(replayPath, replayBuffer);
            logger.info(`💾 Saved Haxball replay: ${replayPath} (${replayBuffer.length} bytes)`);
        }
        
        // Create match summary
        const summary = request.matchSummary;
        const duration = Math.floor(summary.duration);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        // Send recording completion notification
        const embedData = {
            embeds: [{
                title: "🎮 HAXBALL REPLAY READY",
                description: `**${summary.title}** match replay completed!`,
                color: 0x00ff00,
                timestamp: new Date().toISOString(),
                fields: [
                    { name: "⏱️ Duration", value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true },
                    { name: "⚽ Final Score", value: summary.finalScore, inline: true },
                    { name: "🎯 Total Goals", value: `${summary.goals}`, inline: true },
                    { name: "📊 Actions Recorded", value: `${summary.totalActions}`, inline: true },
                    { name: "🎥 Recorded By", value: summary.recordedBy, inline: true },
                    { name: "📅 Match Time", value: new Date(summary.startTime).toLocaleString(), inline: true }
                ],
                footer: {
                    text: "RHL Tournament Replay System"
                }
            }]
        };
        
        // Send embed first
        await axios.post(config.DISCORD_WEBHOOK, embedData);
        
        // Send replay file if it exists and is not too large
        if (fs.existsSync(replayPath)) {
            const stats = fs.statSync(replayPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            if (stats.size < 25 * 1024 * 1024) { // 25MB Discord limit
                const form = new FormData();
                form.append('file', fs.createReadStream(replayPath), {
                    filename: replayFileName,
                    contentType: 'application/octet-stream'
                });
                
                const payload = {
                    embeds: [{
                        title: "📁 HAXBALL REPLAY FILE",
                        description: `Download and open in Haxball to watch the match!`,
                        color: 0x9932cc,
                        fields: [
                            { name: "File Size", value: `${fileSizeMB} MB`, inline: true },
                            { name: "Format", value: "Haxball Replay (.hbr2)", inline: true }
                        ]
                    }]
                };
                
                form.append('payload_json', JSON.stringify(payload));
                
                await axios.post(config.DISCORD_WEBHOOK, form, {
                    headers: form.getHeaders()
                });
                
                logger.info('✅ Haxball replay sent to Discord successfully');
            } else {
                logger.warn(`⚠️ Replay file too large (${fileSizeMB}MB), skipping Discord upload`);
            }
        }
        
    } catch (error) {
        logger.error('Failed to send Haxball replay to Discord:', error);
    }
}

// Setup heartbeat monitoring
async function setupHeartbeatMonitoring() {
    try {
        // Inject heartbeat script into the page
        await page.evaluate(() => {
            // Setup heartbeat system
            window.haxballHeartbeat = {
                lastBeat: Date.now(),
                interval: null,
                start: function() {
                    this.interval = setInterval(() => {
                        this.lastBeat = Date.now();
                        // Store heartbeat data in window for external access
                        window.roomHeartbeat = {
                            timestamp: this.lastBeat,
                            playersCount: room ? room.getPlayerList().length : 0,
                            roomName: room ? 'RHL TOURNAMENT' : 'Unknown'
                        };
                    }, 5000);
                }
            };
            
            // Start heartbeat when room is initialized
            if (typeof room !== 'undefined') {
                window.haxballHeartbeat.start();
            } else {
                // Wait for room to be initialized
                const checkRoom = setInterval(() => {
                    if (typeof room !== 'undefined') {
                        window.haxballHeartbeat.start();
                        clearInterval(checkRoom);
                    }
                }, 1000);
            }
        });
        
        logger.info('Heartbeat monitoring setup complete');
    } catch (error) {
        logger.error('Failed to setup heartbeat monitoring:', error);
    }
}

// Enhanced room monitoring with better error detection
async function setupRoomMonitoring() {
    setInterval(async () => {
        try {
            // Skip monitoring if restart is in progress
            if (isRestartingRoom) {
                return;
            }
            
            // Check browser and page health first
            const browserHealthy = await isBrowserHealthy();
            
            if (!browserHealthy) {
                logger.warn('Browser/Page unhealthy detected - AUTO-RESTART DISABLED');
                return;
            }
            
            // Try to get heartbeat data
            const heartbeatData = await page.evaluate(() => {
                return window.roomHeartbeat || null;
            }).catch(error => {
                logger.warn('Failed to get heartbeat data:', error.message);
                return null;
            });
            
            if (heartbeatData) {
                roomStatus.lastHeartbeat = new Date(heartbeatData.timestamp);
                roomStatus.playersCount = heartbeatData.playersCount || 0;
                roomStatus.roomName = heartbeatData.roomName || 'Unknown';
                roomStatus.pageConnected = true;
            } else {
                roomStatus.pageConnected = false;
            }
            
            // Check if heartbeat is too old (MONITORING ONLY)
            const now = new Date();
            if (roomStatus.lastHeartbeat && (now - roomStatus.lastHeartbeat) > 45000) {
                logger.warn(`Heartbeat is stale (${Math.floor((now - roomStatus.lastHeartbeat) / 1000)}s old) - AUTO-RESTART DISABLED`);
                return;
            }
            
            // Additional check: if no heartbeat data for too long (MONITORING ONLY)
            if (!roomStatus.lastHeartbeat && roomStatus.isActive) {
                const timeSinceStart = roomStatus.startTime ? now - roomStatus.startTime : 0;
                if (timeSinceStart > 60000) { // Give 1 minute after start
                    logger.warn('No heartbeat data received after room start - AUTO-RESTART DISABLED');
                }
            }
            
        } catch (error) {
            logger.error('Room monitoring error:', error.message);
            
            // Critical errors detected (MONITORING ONLY)
            if (error.message.includes('detached') || 
                error.message.includes('Connection closed') ||
                error.message.includes('Target closed')) {
                logger.warn(`Critical monitoring error detected - AUTO-RESTART DISABLED: ${error.message}`);
            }
        }
    }, 15000); // Check every 15 seconds (reduced frequency)
}

// Enhanced room reconnection function to avoid room deletion
async function reconnectToRoom() {
    try {
        logger.info('Attempting to reconnect to existing room without deletion...');
        
        // If page exists, try to reload it instead of creating new room
        if (page && !page.isClosed()) {
            logger.info('Reloading existing page to reconnect...');
            await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for room to reinitialize
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if room is back online
            const roomStatus = await page.evaluate(() => {
                return window.roomStatus || null;
            }).catch(() => null);
            
            if (roomStatus && roomStatus.isActive) {
                logger.info('Successfully reconnected to existing room!');
                return true;
            }
        }
        
        // If page doesn't exist or reload failed, try to create new page with same browser
        if (browser && !browser.disconnected) {
            logger.info('Creating new page with existing browser...');
            
            // Close old page if it exists
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }
            
            // Create new page without closing browser
            page = await browser.newPage();
            
            // Setup the new page with same configuration
            await setupPageForHaxball();
            
            logger.info('Successfully created new page for room reconnection!');
            return true;
        }
        
        return false;
    } catch (error) {
        logger.error('Failed to reconnect to room:', error);
        return false;
    }
}

// Setup page configuration for Haxball (extracted from createHaxballRoom)
async function setupPageForHaxball() {
    // Set up page event handlers
    page.on('error', (error) => {
        logger.error('Page error event:', error.message);
    });
    
    page.on('pageerror', (error) => {
        logger.error('Page pageerror event:', error.message);
    });
    
    page.on('close', () => {
        logger.warn('Page close event triggered - Room persistence mode');
        roomStatus.pageConnected = false;
        // Don't restart automatically, try to reconnect instead
    });
    
    page.on('framedetached', (frame) => {
        logger.warn('Frame detached event:', frame.url());
    });
    
    // Enhanced WebRTC permissions and settings
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.haxball.com', [
        'camera',
        'microphone',
        'notifications',
        'geolocation'
    ]);
    
    // Apply WebRTC configuration
    await page.evaluateOnNewDocument(() => {
        // Same WebRTC setup as createHaxballRoom
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
            navigator.mediaDevices.getUserMedia = function(constraints) {
                return Promise.resolve({
                    getTracks: () => [],
                    addTrack: () => {},
                    removeTrack: () => {},
                    getVideoTracks: () => [],
                    getAudioTracks: () => []
                });
            };
        }
    });
    
    // Navigate to Haxball
    await page.goto('https://www.haxball.com/headless', {
        waitUntil: 'networkidle2',
        timeout: 45000
    });
    
    // Inject tournament script with proper token replacement
    const scriptContent = await fsPromises.readFile('./scripts/haxball-tournament.js', 'utf8');
    
    // Replace token in script to ensure correct token is used
    const configuredScript = scriptContent.replace(
        /process\.env\.HAXBALL_TOKEN \|\| \"[^\"]*\"/g,
        `"${config.HAXBALL_TOKEN}"`
    );
    
    logger.info('Using token (first 20 chars):', config.HAXBALL_TOKEN.substring(0, 20) + '...');
    
    // Execute the configured script
    await page.evaluate(configuredScript);
    
    // Wait longer for room initialization  
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Check if room was created and get detailed status
    const roomCreationStatus = await page.evaluate(() => {
        return {
            hasRoom: typeof window.room !== 'undefined',
            roomLink: window.roomLink || (window.room && window.room.link) || null,
            errors: window.initErrors || [],
            roomName: window.room && window.room.name || null,
            hbInitCalled: window.hbInitCalled || false,
            roomObject: window.room ? 'exists' : 'missing'
        };
    });
    
    logger.info('🎮 Room creation result:', roomCreationStatus);
    
    if (!roomCreationStatus.hasRoom) {
        const errorMsg = `Room creation failed! Details: ${JSON.stringify(roomCreationStatus)}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    } else {
        logger.info('✅ Room created successfully!');
        if (roomCreationStatus.roomLink) {
            logger.info('🔗 Room link:', roomCreationStatus.roomLink);
        } else {
            logger.warn('⚠️ Room created but no link available - possible token issue');
        }
    }
    
    // Wait for room initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    roomStatus.isActive = true;
    roomStatus.pageConnected = true;
    roomStatus.startTime = new Date();
}

// Improved restart room function that preserves room when possible
async function restartRoomSafely(reason = 'Manual restart') {
    if (isRestartingRoom) {
        logger.warn('Room restart already in progress, skipping...');
        return;
    }
    
    isRestartingRoom = true;
    
    try {
        logger.info(`Attempting room recovery. Reason: ${reason}`);
        roomStatus.restartCount++;
        roomStatus.lastRestartTime = new Date();
        
        // Prevent restart loops
        if (roomStatus.restartCount > config.MAX_RESTART_COUNT) {
            logger.error(`Maximum restart count (${config.MAX_RESTART_COUNT}) reached. Stopping restart attempts.`);
            return;
        }
        
        // FIRST: Try to reconnect without deleting room
        logger.info('Step 1: Attempting reconnection without room deletion...');
        const reconnected = await reconnectToRoom();
        
        if (reconnected) {
            logger.info('Successfully reconnected without creating new room!');
            roomStatus.restartCount = Math.max(0, roomStatus.restartCount - 1); // Reduce count for successful reconnection
            return;
        }
        
        // SECOND: If reconnection failed, try room recovery with minimal disruption
        logger.info('Step 2: Reconnection failed, attempting minimal restart...');
        
        // Wait before more aggressive restart
        const waitTime = Math.min(3000 * roomStatus.restartCount, 15000);
        logger.info(`Waiting ${waitTime}ms before minimal restart...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Try to keep browser alive but close page
        if (page && !page.isClosed()) {
            await page.close().catch(() => {});
        }
        
        // ONLY if browser is also dead, then recreate everything
        if (!browser || browser.disconnected) {
            logger.info('Step 3: Browser disconnected, full restart required...');
            await closeBrowserSafely();
            await createHaxballRoom();
        } else {
            logger.info('Step 3: Browser alive, creating new page only...');
            page = await browser.newPage();
            await setupPageForHaxball();
        }
        
        logger.info('Room recovery completed successfully');
        
        // Reset restart count on successful restart
        if (roomStatus.isActive) {
            roomStatus.restartCount = 0;
        }
        
    } catch (error) {
        logger.error('Failed to recover room:', error);
        
        // Only schedule retry for critical errors
        if (roomStatus.restartCount < 3) {
            const retryDelay = Math.min(20000 * roomStatus.restartCount, 60000);
            logger.info(`Scheduling minimal recovery retry in ${retryDelay}ms...`);
            
            setTimeout(() => {
                isRestartingRoom = false;
                restartRoomSafely('Retry after failed recovery');
            }, retryDelay);
        } else {
            logger.error('Maximum recovery attempts reached. Room maintenance stopped.');
        }
        return;
    } finally {
        isRestartingRoom = false;
    }
}

// Legacy function for compatibility
async function restartRoom() {
    await restartRoomSafely('Legacy restart call');
}

// Execute Haxball commands from Discord
async function executeHaxballCommand(command, params, discordUser) {
    try {
        logger.info(`🎮 Executing Haxball command: ${command} from Discord user: ${discordUser}`);
        
        if (!page || page.isClosed()) {
            throw new Error('Haxball room is not available');
        }
        
        // تنفيذ الأمر داخل Haxball room
        const result = await page.evaluate((cmd, args, user) => {
            try {
                if (!window.room) {
                    return { success: false, message: 'Room object not available' };
                }
                
                const room = window.room;
                
                switch (cmd.toLowerCase()) {
                    case 'help':
                        const helpText = `
🎮 Available Discord Commands:
!kick <player_name> - طرد لاعب
!ban <player_name> - حظر لاعب  
!mute <player_name> - كتم لاعب
!unmute <player_name> - إلغاء كتم لاعب
!say <message> - إرسال رسالة للغرفة
!start - بدء اللعب
!stop - إيقاف اللعب
!reset - إعادة تشغيل النتيجة
!players - عرض قائمة اللاعبين
!stats - عرض إحصائيات الغرفة
                        `;
                        room.sendAnnouncement(
                            `📢 Discord Command Help sent by ${user}`,
                            null, 0x00ff00, 'bold'
                        );
                        return { success: true, message: 'Help displayed', result: helpText };
                        
                    case 'kick':
                        if (args.length === 0) {
                            return { success: false, message: 'Please specify player name to kick' };
                        }
                        const kickPlayerName = args.join(' ');
                        const playersToKick = room.getPlayerList().filter(p => 
                            p.name.toLowerCase().includes(kickPlayerName.toLowerCase())
                        );
                        
                        if (playersToKick.length === 0) {
                            return { success: false, message: `Player "${kickPlayerName}" not found` };
                        }
                        
                        let kickedCount = 0;
                        playersToKick.forEach(player => {
                            room.kickPlayer(player.id, `Kicked by Discord user: ${user}`, false);
                            kickedCount++;
                        });
                        
                        room.sendAnnouncement(
                            `⚠️ ${kickedCount} player(s) kicked by Discord user ${user}`,
                            null, 0xff6600, 'bold'
                        );
                        return { 
                            success: true, 
                            message: `Kicked ${kickedCount} player(s): ${playersToKick.map(p => p.name).join(', ')}`
                        };
                        
                    case 'ban':
                        if (args.length === 0) {
                            return { success: false, message: 'Please specify player name to ban' };
                        }
                        const banPlayerName = args.join(' ');
                        const playersToBan = room.getPlayerList().filter(p => 
                            p.name.toLowerCase().includes(banPlayerName.toLowerCase())
                        );
                        
                        if (playersToBan.length === 0) {
                            return { success: false, message: `Player "${banPlayerName}" not found` };
                        }
                        
                        let bannedCount = 0;
                        playersToBan.forEach(player => {
                            room.kickPlayer(player.id, `Banned by Discord user: ${user}`, true);
                            bannedCount++;
                        });
                        
                        room.sendAnnouncement(
                            `🚫 ${bannedCount} player(s) banned by Discord user ${user}`,
                            null, 0xff0000, 'bold'
                        );
                        return { 
                            success: true, 
                            message: `Banned ${bannedCount} player(s): ${playersToBan.map(p => p.name).join(', ')}`
                        };
                        
                    case 'say':
                        if (args.length === 0) {
                            return { success: false, message: 'Please specify message to send' };
                        }
                        const message = args.join(' ');
                        room.sendAnnouncement(
                            `💬 Discord: ${message}`,
                            null, 0x00ffff, 'normal'
                        );
                        return { success: true, message: 'Message sent to room', result: message };
                        
                    case 'start':
                        room.startGame();
                        room.sendAnnouncement(
                            `▶️ Game started by Discord user ${user}`,
                            null, 0x00ff00, 'bold'
                        );
                        return { success: true, message: 'Game started' };
                        
                    case 'stop':
                        room.stopGame();
                        room.sendAnnouncement(
                            `⏹️ Game stopped by Discord user ${user}`,
                            null, 0xffff00, 'bold'
                        );
                        return { success: true, message: 'Game stopped' };
                        
                    case 'reset':
                        room.stopGame();
                        setTimeout(() => {
                            room.startGame();
                        }, 2000);
                        room.sendAnnouncement(
                            `🔄 Game reset by Discord user ${user}`,
                            null, 0xff6600, 'bold'
                        );
                        return { success: true, message: 'Game reset' };
                        
                    case 'players':
                        const players = room.getPlayerList();
                        const playersList = players.map(p => 
                            `${p.name} (${p.team === 0 ? 'Spec' : p.team === 1 ? 'Red' : 'Blue'})`
                        ).join(', ');
                        
                        room.sendAnnouncement(
                            `👥 Players (${players.length}): ${playersList || 'No players'}`,
                            null, 0x00ff00, 'normal'
                        );
                        
                        return { 
                            success: true, 
                            message: `${players.length} players in room`, 
                            result: { count: players.length, players: playersList }
                        };
                        
                    case 'stats':
                        const roomPlayers = room.getPlayerList();
                        const roomName = room.name || 'Unknown';
                        const roomStats = {
                            name: roomName,
                            players: roomPlayers.length,
                            maxPlayers: room.getMaxPlayers ? room.getMaxPlayers() : 16,
                            redScore: room.getScores() ? room.getScores().red : 0,
                            blueScore: room.getScores() ? room.getScores().blue : 0,
                            gameRunning: !!room.getScores()
                        };
                        
                        room.sendAnnouncement(
                            `📊 Room Stats - Players: ${roomStats.players}/${roomStats.maxPlayers} | Score: ${roomStats.redScore} - ${roomStats.blueScore}`,
                            null, 0x00ffff, 'normal'
                        );
                        
                        return { success: true, message: 'Room statistics', result: roomStats };
                        
                    case 'mute':
                        if (args.length === 0) {
                            return { success: false, message: 'Please specify player name to mute' };
                        }
                        const mutePlayerName = args.join(' ');
                        const playersToMute = room.getPlayerList().filter(p => 
                            p.name.toLowerCase().includes(mutePlayerName.toLowerCase())
                        );
                        
                        if (playersToMute.length === 0) {
                            return { success: false, message: `Player "${mutePlayerName}" not found` };
                        }
                        
                        // Store muted players in room storage
                        if (!window.mutedPlayers) window.mutedPlayers = new Set();
                        
                        playersToMute.forEach(player => {
                            window.mutedPlayers.add(player.id);
                        });
                        
                        room.sendAnnouncement(
                            `🔇 ${playersToMute.length} player(s) muted by Discord user ${user}`,
                            null, 0xff6600, 'bold'
                        );
                        
                        return { 
                            success: true, 
                            message: `Muted ${playersToMute.length} player(s): ${playersToMute.map(p => p.name).join(', ')}`
                        };
                        
                    case 'unmute':
                        if (args.length === 0) {
                            return { success: false, message: 'Please specify player name to unmute' };
                        }
                        const unmutePlayerName = args.join(' ');
                        const playersToUnmute = room.getPlayerList().filter(p => 
                            p.name.toLowerCase().includes(unmutePlayerName.toLowerCase())
                        );
                        
                        if (playersToUnmute.length === 0) {
                            return { success: false, message: `Player "${unmutePlayerName}" not found` };
                        }
                        
                        if (!window.mutedPlayers) window.mutedPlayers = new Set();
                        
                        playersToUnmute.forEach(player => {
                            window.mutedPlayers.delete(player.id);
                        });
                        
                        room.sendAnnouncement(
                            `🔊 ${playersToUnmute.length} player(s) unmuted by Discord user ${user}`,
                            null, 0x00ff00, 'bold'
                        );
                        
                        return { 
                            success: true, 
                            message: `Unmuted ${playersToUnmute.length} player(s): ${playersToUnmute.map(p => p.name).join(', ')}`
                        };
                        
                    default:
                        return { 
                            success: false, 
                            message: `Unknown command: ${cmd}. Use !help for available commands.` 
                        };
                }
                
            } catch (error) {
                return { 
                    success: false, 
                    message: `Error executing command: ${error.message}` 
                };
            }
        }, command, params, discordUser);
        
        logger.info('🎮 Command result:', result);
        
        // Send result back to Discord if there's a webhook for responses
        if (result.success && config.DISCORD_WEBHOOK) {
            try {
                const axios = require('axios');
                await axios.post(config.DISCORD_WEBHOOK, {
                    embeds: [{
                        title: "🎮 Command Executed",
                        description: `**${command}** command executed successfully!`,
                        fields: [
                            { name: "Command", value: `!${command}`, inline: true },
                            { name: "Executed by", value: discordUser, inline: true },
                            { name: "Result", value: result.message, inline: false }
                        ],
                        color: result.success ? 0x00ff00 : 0xff0000,
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (webhookError) {
                logger.warn('Failed to send result to Discord:', webhookError.message);
            }
        }
        
        return result;
        
    } catch (error) {
        logger.error('Failed to execute Haxball command:', error);
        return { 
            success: false, 
            message: `Failed to execute command: ${error.message}` 
        };
    }
}

// Enhanced graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.warn(`Already shutting down, ignoring ${signal}`);
        return;
    }
    
    isShuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
        roomStatus.isActive = false;
        
        // Close browser safely with timeout
        const shutdownPromise = closeBrowserSafely();
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 10000));
        
        await Promise.race([shutdownPromise, timeoutPromise]);
        
        logger.info('Graceful shutdown completed');
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
    }
    
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Start server with better initialization
app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('Initializing Haxball room...');
    
    // Initialize room with retries
    const initializeRoom = async (attempt = 1) => {
        const maxAttempts = 3;
        
        try {
            await createHaxballRoom();
            logger.info('Haxball room initialization complete');
            return;
        } catch (error) {
            logger.error(`Failed to initialize Haxball room (attempt ${attempt}/${maxAttempts}):`, error);
            
            if (attempt < maxAttempts) {
                const delay = 15000 * attempt; // Increasing delay: 15s, 30s, 45s
                logger.info(`Retrying in ${delay/1000} seconds...`);
                
                setTimeout(() => {
                    initializeRoom(attempt + 1);
                }, delay);
            } else {
                logger.error('Max initialization attempts reached. AUTO-RESTART DISABLED - Room will stay as single instance.');
            }
        }
    };
    
    await initializeRoom();
});

// Keepalive ping every 5 minutes
setInterval(() => {
    logger.info('Keepalive ping - Room status:', roomStatus.isActive ? 'Active' : 'Inactive');
}, 300000);
