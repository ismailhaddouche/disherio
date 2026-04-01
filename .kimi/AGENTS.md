---
memory_type: local_override
scope: personal
tags: [local, personal-preferences]
priority: 200
created: 2026-04-01
---

# 👤 DisherIo - Local Preferences

> **Type:** Local Override (gitignored)  
> **Purpose:** Personal preferences and local overrides  
> **Created:** 2026-04-01

---

## 🔧 Development Preferences

### Editor & Workflow
- **IDE:** VS Code with extensions: Angular Language Service, ESLint, Prettier
- **Terminal:** Use integrated terminal in VS Code
- **Git GUI:** VS Code built-in or GitKraken for complex operations

### Code Style Preferences
- Prefer **single quotes** for strings
- Use **2 spaces** for indentation
- **Semicolons:** Always (ASI is risky)
- **Trailing commas:** Yes (cleaner diffs)

### Comments
- Write comments in **Spanish** for business logic
- Write comments in **English** for technical implementations
- Use JSDoc/TSDoc for function documentation

---

## 🚀 Local Development Setup

### Quick Start
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm start

# Terminal 3 - Docker (if needed)
docker-compose up -d mongodb
```

### VS Code Tasks
```json
{
  "label": "Start Full Stack",
  "dependsOn": ["Backend Dev", "Frontend Dev"],
  "group": {
    "kind": "build",
    "isDefault": true
  }
}
```

---

## 🧪 Testing Preferences

### Running Tests
- Prefer `npm run test:watch` over single run during development
- Use `.only` for focused tests (remove before commit)
- Mock external services (DB, email, etc.)

### Debug Configuration
```json
{
  "name": "Debug Backend",
  "type": "node",
  "request": "attach",
  "port": 9229,
  "restart": true
}
```

---

## 📝 Notes & Reminders

### Current Focus
- [ ] Implement table management feature
- [ ] Optimize order query performance
- [ ] Add real-time notifications with WebSockets

### Technical Debt
- [ ] Refactor auth middleware (too many responsibilities)
- [ ] Consolidate duplicate types between frontend/backend
- [ ] Improve error handling in controllers

### Ideas for Future
- Mobile app with Ionic/Capacitor
- Kitchen display system (KDS)
- Integration with food delivery platforms

---

## 🐛 Known Issues

### Workarounds
- MongoDB connection timeout on first start → Wait 5 seconds and retry
- Angular HMR sometimes fails → Restart `ng serve`
- CASL type inference issues → Use `AppAbility` type explicitly

---

*Personal configuration - Do not commit sensitive data*
