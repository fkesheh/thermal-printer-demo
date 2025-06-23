const { app, BrowserWindow, ipcMain } = require('electron')
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer')
const { exec } = require('child_process')
const util = require('util')

const execAsync = util.promisify(exec)
let mainWindow = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.loadFile('index.html')
}

// ESC/POS Printer Setup and Functions
let printer = null

// Initialize printer with system printer
const initializePrinter = (printerName = null) => {
  try {
    printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,  // Most Epson printers work with this
      interface: printerName ? `printer:${printerName}` : 'printer:auto',
      characterSet: CharacterSet.PC437_USA,
      removeSpecialCharacters: false,
      lineCharacter: "=",
      driver: require('@thesusheer/electron-printer'),
      breakLine: BreakLine.WORD,
      width: 39,
      options: {
        timeout: 5000
      }
    })
    return true
  } catch (error) {
    console.error('Error initializing printer:', error)
    return false
  }
}

// Alternative method to get printers using Windows command line
const getWindowsPrinters = async () => {
  try {
    if (process.platform !== 'win32') {
      return []
    }
    
    // Use PowerShell to get printer information
    const command = 'powershell "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"'
    const { stdout } = await execAsync(command)
    
    if (stdout.trim()) {
      const printers = JSON.parse(stdout)
      // Handle single printer case (PowerShell returns object, not array)
      const printerArray = Array.isArray(printers) ? printers : [printers]
      
      return printerArray.map(printer => ({
        name: printer.Name || 'Unknown',
        driver: printer.DriverName || 'Unknown Driver',
        port: printer.PortName || 'Unknown Port',
        status: printer.PrinterStatus || 'Unknown'
      }))
    }
    
    return []
  } catch (error) {
    console.log('Could not get printers via PowerShell:', error.message)
    return []
  }
}

// Get list of available system printers dynamically
const getAvailablePrinters = async () => {
  try {
    let systemPrinters = []
    
    // Method 1: Try to get printers using Electron's built-in method
    if (mainWindow && mainWindow.webContents) {
      try {
        // Try the async version first (newer Electron versions)
        if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
          systemPrinters = await mainWindow.webContents.getPrintersAsync()
          console.log('Found system printers (async):', systemPrinters.map(p => p.name))
        }
        // Try the sync version (older Electron versions)
        else if (typeof mainWindow.webContents.getPrinters === 'function') {
          systemPrinters = mainWindow.webContents.getPrinters()
          console.log('Found system printers (sync):', systemPrinters.map(p => p.name))
        }
        else {
          console.log('getPrinters method not available in this Electron version')
        }
      } catch (error) {
        console.log('Could not get printers via webContents:', error.message)
      }
    }
    
    // Method 2: If Electron method failed, try Windows command line
    if ((!systemPrinters || systemPrinters.length === 0) && process.platform === 'win32') {
      console.log('Trying Windows PowerShell printer detection...')
      const windowsPrinters = await getWindowsPrinters()
      if (windowsPrinters.length > 0) {
        systemPrinters = windowsPrinters.map(p => ({ name: p.name }))
        console.log('Found system printers (PowerShell):', systemPrinters.map(p => p.name))
      }
    }
    
    // Format the printer list - only include actual system printers
    const printerList = ['Auto-detect printer']
    
    if (systemPrinters && systemPrinters.length > 0) {
      // Add all system printers
      systemPrinters.forEach(printer => {
        if (printer.name && !printerList.includes(printer.name)) {
          printerList.push(printer.name)
        }
      })
      console.log(`Successfully detected ${systemPrinters.length} system printer(s)`)
    } else {
      console.log('No system printers detected. Make sure your printer is installed and drivers are working.')
      printerList.push('No printers detected - Check printer installation')
    }
    
    return printerList
    
  } catch (error) {
    console.error('Error getting printers:', error)
    // Return minimal list on error
    return [
      'Auto-detect printer',
      'Error detecting printers - Check system'
    ]
  }
}

// Get detailed printer information
const getPrinterDetails = async () => {
  try {
    let printers = []
    
    // Method 1: Try Electron's built-in methods
    if (mainWindow && mainWindow.webContents) {
      // Try the async version first (newer Electron versions)
      if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
        printers = await mainWindow.webContents.getPrintersAsync()
      }
      // Try the sync version (older Electron versions)
      else if (typeof mainWindow.webContents.getPrinters === 'function') {
        printers = mainWindow.webContents.getPrinters()
      }
    }
    
    // Method 2: If Electron method failed or not available, try Windows command line
    if ((!printers || printers.length === 0) && process.platform === 'win32') {
      console.log('Using PowerShell for detailed printer information...')
      const windowsPrinters = await getWindowsPrinters()
      if (windowsPrinters.length > 0) {
        return windowsPrinters.map(printer => ({
          name: printer.name,
          displayName: printer.name,
          description: `Driver: ${printer.driver}, Port: ${printer.port}`,
          status: printer.status.toLowerCase(),
          isDefault: false, // Would need additional command to determine default
          options: { driver: printer.driver, port: printer.port }
        }))
      }
    }
    
    // Method 3: If we have Electron printer data, format it
    if (printers && printers.length > 0) {
      return printers.map(printer => ({
        name: printer.name || 'Unknown',
        displayName: printer.displayName || printer.name || 'Unknown',
        description: printer.description || 'No description available',
        status: printer.status || 'unknown',
        isDefault: printer.isDefault || false,
        options: printer.options || {}
      }))
    }
    
    // Fallback: Return a message indicating no detection method worked
    return [{
      name: 'Detection method unavailable',
      displayName: 'Printer detection not supported',
      description: `Electron version: ${process.versions.electron || 'unknown'} - getPrinters methods not available`,
      status: 'unavailable',
      isDefault: false,
      options: {}
    }]
    
  } catch (error) {
    console.error('Error getting printer details:', error)
    return [{
      name: 'Error',
      displayName: 'Error getting printer info',
      description: `Error: ${error.message}`,
      status: 'error',
      isDefault: false,
      options: {}
    }]
  }
}

// Print image demo
const printImageDemo = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    printer.clear()
    printer.alignCenter()
    printer.bold(true)
    printer.println('🖼️ IMAGE PRINTING DEMO')
    printer.bold(false)
    printer.drawLine()
    
    printer.println('Printing sample image...')
    printer.newLine()
    
    // Print the image - make sure the path exists
    try {
      await printer.printImage('./assets/olaii-logo-black-small.png')
      printer.newLine()
      printer.println('Image printed successfully!')
    } catch (imageError) {
      console.log('Image file not found, printing text version instead')
      printer.println('[ IMAGE PLACEHOLDER ]')
      printer.println('Sample Logo Here')
      printer.println('(Create ./assets/olaii-logo-black-small.png)')
      printer.println('to see actual image printing')
    }
    
    printer.newLine()
    printer.alignCenter()
    printer.println('Image Demo Complete')
    printer.newLine()
    printer.newLine()
    printer.cut()
    
    const result = await printer.execute()
    return { success: true, message: 'Image demo printed successfully!' }
    
  } catch (error) {
    console.error('Image print error:', error)
    return { success: false, message: `Image print failed: ${error.message}` }
  }
}

// Print partial cut demo
const printPartialCutDemo = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    printer.clear()
    printer.alignCenter()
    printer.bold(true)
    printer.println('✂️ PARTIAL CUT DEMO')
    printer.bold(false)
    printer.drawLine()
    
    printer.alignLeft()
    printer.println('This demonstrates partial cutting.')
    printer.println('The paper will be cut most of the way')
    printer.println('through, but will remain connected')
    printer.println('by a small strip.')
    printer.newLine()
    printer.println('You can tear it off easily.')
    printer.newLine()
    
    printer.alignCenter()
    printer.println('--- PARTIAL CUT LINE ---')
    printer.newLine()
    
    // Perform partial cut
    printer.partialCut()
    
    printer.println('--- AFTER PARTIAL CUT ---')
    printer.println('This text prints after the')
    printer.println('partial cut operation.')
    printer.newLine()
    printer.println(`Time: ${new Date().toLocaleTimeString()}`)
    printer.newLine()
    printer.newLine()
    
    const result = await printer.execute()
    return { success: true, message: 'Partial cut demo printed successfully!' }
    
  } catch (error) {
    console.error('Partial cut error:', error)
    return { success: false, message: `Partial cut failed: ${error.message}` }
  }
}

// Print full cut demo
const printFullCutDemo = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    printer.clear()
    printer.alignCenter()
    printer.bold(true)
    printer.println('✂️ FULL CUT DEMO')
    printer.bold(false)
    printer.drawLine()
    
    printer.alignLeft()
    printer.println('This demonstrates full cutting.')
    printer.println('The paper will be completely')
    printer.println('cut through, separating this')
    printer.println('section from the roll.')
    printer.newLine()
    printer.println('Perfect for receipts and')
    printer.println('individual documents.')
    printer.newLine()
    
    printer.alignCenter()
    printer.println('--- FULL CUT LINE ---')
    printer.println('Paper will be completely cut here')
    printer.newLine()
    printer.println(`Cut performed at: ${new Date().toLocaleTimeString()}`)
    printer.newLine()
    printer.newLine()
    printer.newLine()
    
    // Perform full cut
    printer.cut()
    
    const result = await printer.execute()
    return { success: true, message: 'Full cut demo printed successfully!' }
    
  } catch (error) {
    console.error('Full cut error:', error)
    return { success: false, message: `Full cut failed: ${error.message}` }
  }
}

// Print cutting comparison demo
const printCuttingComparisonDemo = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    printer.clear()
    printer.alignCenter()
    printer.bold(true)
    printer.println('✂️ CUTTING COMPARISON DEMO')
    printer.bold(false)
    printer.drawLine()
    
    printer.alignLeft()
    printer.println('This demo shows both types of cuts:')
    printer.newLine()
    
    // Section 1: Partial Cut
    printer.alignCenter()
    printer.bold(true)
    printer.println('🔸 SECTION 1: PARTIAL CUT')
    printer.bold(false)
    printer.alignLeft()
    printer.println('Text before partial cut.')
    printer.println('Notice how the paper stays')
    printer.println('connected after cutting.')
    printer.newLine()
    printer.alignCenter()
    printer.println('--- PARTIAL CUT HERE ---')
    
    printer.partialCut()
    
    printer.println('Text after partial cut.')
    printer.println('Paper is still connected!')
    printer.newLine()
    printer.newLine()
    
    // Section 2: Full Cut
    printer.alignCenter()
    printer.bold(true)
    printer.println('🔸 SECTION 2: FULL CUT')
    printer.bold(false)
    printer.alignLeft()
    printer.println('Text before full cut.')
    printer.println('This section will be')
    printer.println('completely separated.')
    printer.newLine()
    printer.alignCenter()
    printer.println('--- FULL CUT BELOW ---')
    printer.println('This is the end!')
    printer.newLine()
    printer.newLine()
    printer.newLine()
    
    printer.cut()
    
    const result = await printer.execute()
    return { success: true, message: 'Cutting comparison demo printed successfully!' }
    
  } catch (error) {
    console.error('Cutting comparison error:', error)
    return { success: false, message: `Cutting comparison failed: ${error.message}` }
  }
}

// Enhanced print test receipt with more features
const printTestReceipt = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    // Clear any previous content
    printer.clear()

    // Store header
    printer.alignCenter()
    printer.setTextSize(1, 1)
    printer.bold(true)
    printer.println('THERMAL PRINTER DEMO')
    printer.bold(false)
    printer.setTextSize(0, 0)
    printer.println('123 Main Street')
    printer.println('Anytown, ST 12345')
    printer.println('Tel: (555) 123-4567')
    printer.println('www.mydemostore.com')
    
    printer.drawLine()
    
    // Transaction details
    printer.alignLeft()
    printer.println(`Date: ${new Date().toLocaleDateString()}`)
    printer.println(`Time: ${new Date().toLocaleTimeString()}`)
    printer.println('Receipt #: 0001234')
    printer.println('Cashier: Demo User')
    printer.println('Terminal: 01')
    
    printer.drawLine()
    
    // Items table
    printer.bold(true)
    printer.leftRight('ITEM', 'PRICE')
    printer.bold(false)
    printer.leftRight('Americano Coffee', '$3.50')
    printer.leftRight('Blueberry Muffin', '$2.99')
    printer.leftRight('Chocolate Croissant', '$4.25')
    printer.leftRight('Orange Juice', '$2.75')
    
    printer.drawLine()
    
    // Totals
    printer.leftRight('Subtotal:', '$13.49')
    printer.leftRight('Tax (8.5%):', '$1.15')
    printer.bold(true)
    printer.setTextSize(1, 0)
    printer.leftRight('TOTAL:', '$14.64')
    printer.setTextSize(0, 0)
    printer.bold(false)
    
    printer.leftRight('Cash Tendered:', '$20.00')
    printer.leftRight('Change:', '$5.36')
    
    printer.drawLine()
    
    // Barcode example (using Code128)
    printer.alignCenter()
    printer.println('Transaction ID:')
    printer.code128('TXN123456789', {
      width: "MEDIUM",
      height: 60,
      text: 2  // Text below barcode
    })
    
    printer.newLine()
    
    // QR code with transaction info
    printer.println('Scan for receipt details:')
    printer.printQR('Receipt: TXN123456789\nTotal: $14.64\nDate: ' + new Date().toLocaleDateString(), {
      cellSize: 3,
      correction: 'M',
      model: 2
    })
    
    printer.newLine()
    
    // Footer
    printer.alignCenter()
    printer.println('Thank you for your visit!')
    printer.println('Please come again!')
    printer.newLine()
    printer.setTextSize(0, 0)
    printer.println('Return Policy: 30 days with receipt')
    printer.println('Customer Service: (555) 123-HELP')
    
    printer.newLine()
    printer.newLine()
    printer.newLine()
    
    // Cut the paper
    printer.cut()
    
    // Execute the print job
    const result = await printer.execute()
    console.log('Print job executed successfully:', result)
    return { success: true, message: 'Enhanced receipt printed successfully!' }
    
  } catch (error) {
    console.error('Print error:', error)
    return { success: false, message: `Print failed: ${error.message}` }
  }
}

// Print custom text with enhanced formatting
const printCustomText = async (text) => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    printer.clear()
    
    // Header
    printer.alignCenter()
    printer.setTextSize(1, 1)
    printer.bold(true)
    printer.println('📄 CUSTOM PRINT')
    printer.bold(false)
    printer.setTextSize(0, 0)
    printer.drawLine()
    
    // Content
    printer.alignLeft()
    printer.setTextNormal()
    printer.println(text)
    
    printer.newLine()
    printer.drawLine()
    
    // Footer with timestamp
    printer.alignCenter()
    printer.setTextSize(0, 0)
    printer.println(`Printed: ${new Date().toLocaleString()}`)
    printer.println('Powered by node-thermal-printer')
    
    printer.newLine()
    printer.newLine()
    
    printer.cut()
    
    const result = await printer.execute()
    console.log('Custom text printed successfully:', result)
    return { success: true, message: 'Custom text printed successfully!' }
    
  } catch (error) {
    console.error('Print error:', error)
    return { success: false, message: `Print failed: ${error.message}` }
  }
}

// Test printer connection with more detailed info
const testPrinterConnection = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, connected: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }
    
    // Print a simple test line
    printer.clear()
    printer.alignCenter()
    printer.println('🔍 CONNECTION TEST')
    printer.println(`${new Date().toLocaleTimeString()}`)
    printer.println('If you see this, connection works!')
    printer.newLine()
    printer.cut()
    
    const result = await printer.execute()
    return { 
      success: true, 
      connected: true, 
      message: 'Connection test printed successfully!' 
    }
    
  } catch (error) {
    console.error('Connection test error:', error)
    return { 
      success: false, 
      connected: false, 
      message: `Connection test failed: ${error.message}` 
    }
  }
}

// Print barcode demo
const printBarcodeDemo = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    printer.clear()
    printer.alignCenter()
    printer.bold(true)
    printer.println('📊 BARCODE DEMO')
    printer.bold(false)
    printer.drawLine()
    
    // Code128 Barcode
    printer.println('Code128 Barcode:')
    printer.code128('DEMO123456', {
      width: "MEDIUM",
      height: 60,
      text: 2
    })
    
    printer.newLine()
    
    // QR Code variations
    printer.println('QR Code - Small:')
    printer.printQR('Small QR Code Test', {
      cellSize: 2,
      correction: 'L',
      model: 2
    })
    
    printer.newLine()
    printer.println('QR Code - Large:')
    printer.printQR('https://github.com/Klemen1337/node-thermal-printer', {
      cellSize: 4,
      correction: 'M',
      model: 2
    })
    
    printer.newLine()
    printer.newLine()
    printer.cut()
    
    const result = await printer.execute()
    return { success: true, message: 'Barcode demo printed successfully!' }
    
  } catch (error) {
    console.error('Barcode print error:', error)
    return { success: false, message: `Barcode print failed: ${error.message}` }
  }
}

// Print table demo
const printTableDemo = async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }

    printer.clear()
    printer.alignCenter()
    printer.bold(true)
    printer.println('📋 TABLE DEMO')
    printer.bold(false)
    printer.drawLine()
    
    // Simple table
    printer.alignLeft()
    printer.println('Simple Table:')
    printer.table(['Product', 'Qty', 'Price'])
    printer.table(['Coffee', '2', '$7.00'])
    printer.table(['Muffin', '1', '$2.99'])
    printer.table(['Total', '', '$9.99'])
    
    printer.newLine()
    
    // Custom table
    printer.println('Custom Formatted Table:')
    printer.tableCustom([
      { text: 'Item', align: 'LEFT', width: 0.5, bold: true },
      { text: 'Qty', align: 'CENTER', width: 0.2, bold: true },
      { text: 'Price', align: 'RIGHT', width: 0.3, bold: true }
    ])
    
    printer.tableCustom([
      { text: 'Espresso', align: 'LEFT', width: 0.5 },
      { text: '1', align: 'CENTER', width: 0.2 },
      { text: '$2.50', align: 'RIGHT', width: 0.3 }
    ])
    
    printer.tableCustom([
      { text: 'Cappuccino', align: 'LEFT', width: 0.5 },
      { text: '2', align: 'CENTER', width: 0.2 },
      { text: '$8.00', align: 'RIGHT', width: 0.3 }
    ])
    
    printer.newLine()
    printer.newLine()
    printer.cut()
    
    const result = await printer.execute()
    return { success: true, message: 'Table demo printed successfully!' }
    
  } catch (error) {
    console.error('Table print error:', error)
    return { success: false, message: `Table print failed: ${error.message}` }
  }
}

// IPC Handlers
ipcMain.handle('get-printers', async () => {
  return await getAvailablePrinters()
})

ipcMain.handle('get-printer-details', async () => {
  return await getPrinterDetails()
})

ipcMain.handle('init-printer', async (event, printerName) => {
  const success = initializePrinter(printerName === 'Auto-detect printer' ? null : printerName)
  return { success }
})

ipcMain.handle('print-test-receipt', async () => {
  return await printTestReceipt()
})

ipcMain.handle('print-custom-text', async (event, text) => {
  return await printCustomText(text)
})

ipcMain.handle('test-printer-connection', async () => {
  return await testPrinterConnection()
})

ipcMain.handle('print-barcode-demo', async () => {
  return await printBarcodeDemo()
})

ipcMain.handle('print-table-demo', async () => {
  return await printTableDemo()
})

ipcMain.handle('print-image-demo', async () => {
  return await printImageDemo()
})

ipcMain.handle('print-partial-cut-demo', async () => {
  return await printPartialCutDemo()
})

ipcMain.handle('print-full-cut-demo', async () => {
  return await printFullCutDemo()
})

ipcMain.handle('print-cutting-comparison-demo', async () => {
  return await printCuttingComparisonDemo()
})

ipcMain.handle('open-cash-drawer', async () => {
  try {
    if (!printer) {
      const success = initializePrinter()
      if (!success) {
        return { success: false, message: 'Failed to initialize printer - check driver installation' }
      }
    }
    
    printer.clear()
    printer.openCashDrawer()
    const result = await printer.execute()
    return { success: true, message: 'Cash drawer opened!' }
    
  } catch (error) {
    console.error('Cash drawer error:', error)
    return { success: false, message: `Failed to open cash drawer: ${error.message}` }
  }
})

// Get printer information
ipcMain.handle('get-printer-info', async () => {
  try {
    if (!printer) {
      return { 
        success: false, 
        message: 'No printer initialized' 
      }
    }
    
    return {
      success: true,
      info: {
        width: printer.getWidth(),
        buffer: printer.getBuffer().length,
        type: 'EPSON',
        characterSet: 'PC437_USA'
      }
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

app.whenReady().then(() => {
  createWindow()
  
  // Initialize printer on startup
  initializePrinter()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})