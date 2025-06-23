# ESC/POS Thermal Printer Demo

A demonstration Electron application showcasing thermal printer integration on Windows using `node-thermal-printer` and `@thesusheer/electron-printer`. Mostly coded by AI, so be carefull.

## Overview

This project demonstrates how to integrate ESC/POS thermal printers with an Electron desktop application. It's particularly useful for point-of-sale (POS) systems, receipt printing, and other thermal printing applications on Windows.

## Features

- 🖨️ **Thermal Printer Support**: Compatible with ESC/POS thermal printers
- 🖥️ **Cross-Platform**: Built with Electron for desktop deployment
- 🎯 **Windows Optimized**: Specifically designed and tested for Windows environments
- 📄 **Receipt Printing**: Easy-to-use interface for printing receipts and labels
- ⚡ **Fast Setup**: Quick installation and configuration

## Prerequisites

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)
- **Windows OS** (Windows 10/11 recommended)
- **ESC/POS Compatible Thermal Printer** (Epson, Star, or compatible)

## Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd my-electron-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Usage

### Development Mode
Run the application in development mode with console logging:
```bash
npm run dev
```

### Production Mode
Run the application in production mode:
```bash
npm start
```

### Build Application
Create a packaged version for distribution:
```bash
# Create unpacked directory
npm run pack

# Create installer/executable
npm run dist
```

## Key Dependencies

- **[electron](https://www.electronjs.org/)** - Desktop app framework
- **[node-thermal-printer](https://www.npmjs.com/package/node-thermal-printer)** - Core thermal printing functionality
- **[@thesusheer/electron-printer](https://www.npmjs.com/package/@thesusheer/electron-printer)** - Electron-specific printer integration

## Project Structure

```
my-electron-app/
├── assets/                 # Application assets
│   └── olaii-logo-black-small.png
├── index.html             # Main application UI
├── main.js               # Electron main process
├── package.json          # Project configuration
└── README.md            # This file
```

## Printer Setup

1. **Connect your thermal printer** to your Windows machine via USB or network
2. **Install printer drivers** if required
3. **Test printer functionality** using Windows printer settings
4. **Configure printer settings** in the application as needed

## Supported Printer Models

This demo works with ESC/POS compatible thermal printers including:
- Epson TM series
- Star Micronics
- Generic ESC/POS printers
- Most 58mm and 80mm thermal printers

## Development

To modify or extend this application:

1. **Main Process**: Edit `main.js` for Electron configuration
2. **Renderer Process**: Edit `index.html` for UI changes
3. **Printer Logic**: Integrate with `node-thermal-printer` APIs
4. **Styling**: Add CSS for custom styling

## Troubleshooting

- Ensure printer is properly connected and recognized by Windows
- Check printer drivers are installed correctly
- Verify printer is set as default or properly configured
- Enable developer tools with `npm run dev` for debugging

## License

ISC

## Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

---

**Note**: This is a demonstration project. For production use, consider implementing additional error handling, security measures, and user interface improvements. 