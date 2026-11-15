# HOOLM War Table (Virtual Tabletop Web Game)

This is the interactive 2D virtual tabletop for playing **Heroes of Overleague Machine** in your browser. Set up a board, draft your heroes, place Titans, measure distances, roll dice, and play locally or online with a friend!

---

## How to Start the Game (Step-by-Step)

### Step 1: Open a Terminal (PowerShell)
1. Press the **Windows Key** on your keyboard.
2. Type **PowerShell** and press **Enter**.

### Step 2: Start the Game Board
Copy and paste these two lines into PowerShell and press **Enter**:

```powershell
cd C:\Users\brand\.gemini\antigravity-ide\scratch\hoolm-war-table
npx vite
```

After a second or two, you will see a line that looks like:
`Local: http://localhost:5173/`

### Step 3: Open the Game in Your Browser
Open Chrome, Edge, or Firefox and go to:

👉 **http://localhost:5173**

*(Keep the PowerShell window open while playing! Closing it will shut down the game.)*

---

## Optional: Playing Online / Multiplayer Rooms

If you want to create or join an **Online Room** so two computers can play together in real time, you also need the multiplayer room server running:

1. Leave your first PowerShell window (from Step 2) open.
2. Open a **second PowerShell window**.
3. Copy and paste these two lines and press **Enter**:

```powershell
cd C:\Users\brand\.gemini\antigravity-ide\scratch\hoolm-war-table
node server.js
```

You will see:
`🚀 HOOLM War Table Server listening on http://localhost:3001`

Now online rooms will work inside the game!

---

## How to Update Characters & Keywords in This Game

Do **not** edit the character files inside this folder directly. Instead:
1. Open the **HOOLM Editor** (`hoolm-editor` at `http://localhost:5180`).
2. Edit your characters, stats, abilities, or keywords.
3. Click **Save**, then click **Sync to apps**.
4. Refresh the War Table browser tab (`F5` or `Ctrl + R`) to load the updated characters!

---

## Troubleshooting

- **"This site can't be reached" in the browser:**
  Make sure the PowerShell window running `npx vite` is still open, and check the exact `http://localhost:....` link it printed (usually `5173`, or `5174` if `5173` was busy).
- **How to stop the game:**
  Click inside the PowerShell window and press **Ctrl + C**, or just close the PowerShell window.
