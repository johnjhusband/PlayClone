# PlayClone VS Code Extension

Interactive browser automation recorder and debugger for PlayClone.

## Features

- 🎬 **Browser Recorder**: Record your browser interactions and generate code automatically
- 🔍 **Selector Builder**: Build and test natural language, CSS, and XPath selectors
- 👁️ **Browser Preview**: Live preview of browser state with auto-refresh
- 🎯 **Natural Language**: Use descriptions like "blue login button" instead of complex selectors
- 🚀 **Code Generation**: Generate JavaScript, TypeScript, or Python automation scripts
- 🐛 **Interactive Debugging**: Step through automation with visual feedback

## Installation

1. Install from VS Code Marketplace:
   ```
   ext install playclone.playclone-vscode
   ```

2. Or install from VSIX file:
   ```bash
   code --install-extension playclone-vscode-1.0.0.vsix
   ```

## Quick Start

1. Open the PlayClone panel from the Activity Bar
2. Click "Open Browser" to start a browser session
3. Start recording your actions
4. Stop recording to generate automation code
5. Run the generated script

## Commands

- `PlayClone: Start Recording` - Begin recording browser interactions
- `PlayClone: Stop Recording` - Stop recording and generate code
- `PlayClone: Run Script` - Execute the current script
- `PlayClone: Show Selector Builder` - Open the selector builder panel
- `PlayClone: Open Browser` - Launch a new browser instance
- `PlayClone: Close Browser` - Close the browser instance

## Views

### Recorder View
- Start/stop recording sessions
- View recorded actions in real-time
- Generate code from recordings
- Clear action history

### Selector Builder View
- Test natural language selectors
- Build CSS and XPath selectors
- Smart selector builder with element type detection
- Copy selectors to clipboard

### Browser Preview View
- Live screenshot preview of browser state
- Navigate to URLs directly
- Auto-refresh mode for real-time updates
- Manual refresh control

## Configuration

Configure PlayClone in VS Code settings:

```json
{
  "playclone.browser": "chromium",      // Browser engine: chromium, firefox, webkit
  "playclone.headless": false,          // Run browser in headless mode
  "playclone.slowMo": 0,                // Slow down operations (ms)
  "playclone.timeout": 30000            // Default timeout (ms)
}
```

## Recording Example

1. Start recording:
   ```
   Cmd/Ctrl + Shift + P → PlayClone: Start Recording
   ```

2. Perform actions in the browser:
   - Navigate to websites
   - Click buttons
   - Fill forms
   - Extract data

3. Stop recording and get generated code:
   ```javascript
   import { PlayClone } from 'playclone';

   async function runAutomation() {
       const pc = new PlayClone({
           browser: 'chromium',
           headless: false
       });

       try {
           await pc.launch();
           await pc.navigate('https://example.com');
           await pc.click('login button');
           await pc.fill('username field', 'user@example.com');
           await pc.fill('password field', 'password');
           await pc.click('submit button');
       } finally {
           await pc.close();
       }
   }
   ```

## Natural Language Selectors

Use human-readable descriptions instead of technical selectors:

- ✅ `"blue login button"`
- ✅ `"search input field"`
- ✅ `"first product in list"`
- ✅ `"link containing 'Learn More'"`

## Keyboard Shortcuts

- `Ctrl+Shift+R` - Start/Stop Recording
- `Ctrl+Shift+B` - Open Browser
- `Ctrl+Shift+S` - Show Selector Builder

## Troubleshooting

### Browser doesn't open
- Ensure PlayClone is installed: `npm install playclone`
- Check browser dependencies: `npx playwright install chromium`

### Recording doesn't capture actions
- Make sure browser is launched before recording
- Check that the browser window is focused

### Selector not found
- Use the Selector Builder to test selectors
- Try natural language descriptions
- Check if element is loaded (may need wait)

## Development

To develop the extension:

```bash
cd vscode-extension
npm install
npm run compile
code .
```

Press `F5` to launch a new VS Code window with the extension loaded.

## Requirements

- VS Code 1.74.0 or higher
- Node.js 18.0.0 or higher
- PlayClone package installed

## License

MIT