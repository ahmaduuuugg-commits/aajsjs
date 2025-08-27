# Overview

This is a 24/7 Haxball Tournament Server that provides an automated hosting solution for competitive Haxball gaming. The system creates and maintains persistent tournament rooms using Puppeteer to control a headless browser instance, ensuring continuous availability for players. It features a web dashboard for monitoring room status, player counts, and server health, along with Discord integration for notifications and community management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture
- **Express.js Server**: Core HTTP server handling API endpoints and serving static files
- **Puppeteer Browser Control**: Headless Chrome instance manages the Haxball room through web automation
- **Real-time Monitoring**: Continuous health checks and heartbeat monitoring to ensure room availability
- **Auto-restart Logic**: Intelligent room recovery system that detects failures and recreates rooms automatically

## Frontend Architecture
- **Static Web Dashboard**: HTML/CSS/JS interface for monitoring room status and server health
- **Real-time Status Updates**: Live display of player counts, room status, and uptime metrics
- **Room Access Interface**: Dedicated page providing permanent room links to players

## Configuration Management
- **Environment-based Config**: Centralized configuration system using dotenv for secure credential management
- **Room Parameters**: Configurable settings for room name, player limits, geographic location, and Haxball tokens
- **Monitoring Thresholds**: Adjustable timeouts and intervals for health checks and restart logic

## Process Management
- **Global State Tracking**: Centralized room status management preventing duplicate room creation
- **Restart Prevention**: Safety mechanisms to avoid restart loops and ensure stable operation
- **Browser Lifecycle**: Managed browser instances with proper initialization and cleanup

## Logging and Monitoring
- **Winston Logger**: Structured logging with file rotation and multiple log levels
- **Health Status API**: Endpoints for monitoring server and room health
- **Error Tracking**: Comprehensive error logging and recovery mechanisms

# External Dependencies

## Core Runtime
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework for HTTP server
- **Puppeteer**: Headless Chrome control for browser automation

## Haxball Integration
- **Haxball Platform**: Browser-based multiplayer football game platform
- **WebRTC Infrastructure**: STUN/TURN servers for peer-to-peer connectivity
- **Haxball Tokens**: Authentication tokens for room creation privileges

## Communication Services
- **Discord Webhooks**: Automated notifications and community integration
- **Discord API**: Player reporting and moderation features

## Monitoring and Utilities
- **Winston**: Professional logging framework with file rotation
- **Node-cron**: Scheduled task execution for maintenance
- **Axios**: HTTP client for external API communications
- **WebSocket (ws)**: Real-time communication capabilities
- **Dotenv**: Environment variable management for configuration

## Browser Infrastructure
- **Chromium**: Headless browser engine via Puppeteer
- **WebRTC**: Real-time communication protocol for game connectivity
- **STUN/TURN Servers**: Network traversal services for NAT handling