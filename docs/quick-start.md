# DIP Quick Start Guide

## 🚀 Start in 3 Minutes

### Prerequisites
- Node.js 18+
- Docker running
- Modern browser

### Step 1: Start Everything
```bash
cd /home/mq/dip
./start.sh
```

The script will:
- ✅ Start PostgreSQL database
- ✅ Install backend dependencies
- ✅ Run database migrations
- ✅ Start backend server (http://localhost:3000)
- ✅ Install frontend dependencies
- ✅ Start frontend server (http://localhost:3000 or :3001)

**Wait for "Press Ctrl+C to stop" message**

### Step 2: Register Users
1. Open http://localhost:3000 in your browser
2. Click "Create Account"
3. Register as **user1** with any password
4. Open a **new browser tab** (or use incognito)
5. Register as **user2**

### Step 3: Make a Call
1. In **user1's tab**, find **user2** in the list
2. Click the **"Call"** button
3. In **user2's tab**, click **"Accept"**
4. Both users now have a secure encrypted call! 🎤
5. Click **"End Call"** to disconnect

**That's it!** You've successfully made a secure E2EE voice call!

---

## 📍 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | User interface |
| Backend API | http://localhost:3000/api/v1 | REST endpoints |
| Database | localhost:5432 | PostgreSQL |
| WebSocket | http://localhost:3000 | Signaling |

---

## 🛑 Stop Everything

Press `Ctrl+C` in the terminal running `start.sh`

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Port already in use" | Kill existing process: `lsof -i :3000` then `kill -9 PID` |
| Microphone permission denied | Grant in browser settings |
| "Cannot connect to socket" | Ensure backend is running, check console logs |
| Call not connecting | Check browser console for WebRTC errors |
| Blank page | Clear localStorage and refresh |

---

## 📖 For More Detail

- **Setup Issues:** See [README.md](README.md)
- **Complete Guide:** See [SUMMARY.md](SUMMARY.md)
- **Architecture:** See [REPORT_ARCHITECTURE_TECHNOLOGIES.md](REPORT_ARCHITECTURE_TECHNOLOGIES.md)
- **Development:** See [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)
- **All Docs:** See [INDEX.md](INDEX.md)

---

## 🔐 What's Happening

```
User1 Audio Stream
    ↓
Captured from microphone
    ↓
Encrypted with SRTP
    ↓
Sent directly to User2 (NOT through server)
    ↓
Decrypted on User2's device
    ↓
Played through speakers
```

**Server NEVER has access to voice data or encryption keys!**

---

## ✅ Success Indicators

- ✅ Voice is clearly heard
- ✅ No lag or delay
- ✅ Call status shows "Connected"
- ✅ Can end call and make new ones
- ✅ Can see other users in list

---

**Enjoy your secure voice calls!** 🎤🔐
