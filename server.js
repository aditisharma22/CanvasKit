import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON
app.use(express.json());

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Log request body if it exists
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  
  // Capture the original send method
  const originalSend = res.send;
  
  // Override the send method to log response
  res.send = function(body) {
    console.log(`[${new Date().toISOString()}] Response:`, body);
    // Call the original send method
    return originalSend.call(this, body);
  };
  
  next();
});

// Serve static files
app.use(express.static('./'));

// Test API endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API server is running correctly' });
});

// Route to update rules
app.post('/api/update-rules', async (req, res) => {
  try {
    const { type, name } = req.body;
    
    // Force English locale regardless of what's passed
    const enforceEnglishLocale = 'en';
    
    if (!type || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate rule type
    const validRuleTypes = ['appleServices', 'appGameNames'];
    if (!validRuleTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid rule type. Only appleServices and appGameNames are supported.' });
    }
    
    // Path to en.js file - make sure we're using the absolute path
    console.log('Current directory:', dirname);
    const filePath = path.resolve(dirname, 'src', 'localization', 'rules', `${enforceEnglishLocale}.js`);
    console.log('Attempting to update file:', filePath);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ 
        success: false, 
        error: `Rules file not found: ${err.message}` 
      });
    }
    
    // Read the file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract the rule array
    const ruleRegex = new RegExp(`${type}:\\s*\\[([\\s\\S]*?)\\]`);
    const match = content.match(ruleRegex);
    
    if (!match) {
      return res.status(400).json({ error: `Could not find ${type} in the file` });
    }
    
    // Extract existing items
    const existingItems = match[1].split(',')
      .map(item => item.trim().replace(/"/g, '').replace(/'/g, ''))
      .filter(item => item.length > 0);
    
    // Check if item already exists
    if (existingItems.includes(name)) {
      return res.status(400).json({ error: `"${name}" already exists in ${type}` });
    }
    
    // Add new item
    existingItems.push(name);
    
    // Format the new array
    const formattedArray = existingItems
      .map(item => `    "${item}"`)
      .join(',\n');
    
    // Create the new content
    const newContent = content.replace(
      ruleRegex,
      `${type}: [\n${formattedArray}\n  ]`
    );
    
    // Write the updated content back to the file
    await fs.writeFile(filePath, newContent, 'utf8');
    
    res.status(200).json({ success: true, message: `Successfully added "${name}" to ${type} in English rules.` });
  } catch (error) {
    console.error('Error updating rules:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to update rules: ${error.message}` 
    });
  }
});

// Route to remove rules
app.post('/api/remove-rule', async (req, res) => {
  try {
    const { type, name } = req.body;
    
    // Force English locale regardless of what's passed
    const enforceEnglishLocale = 'en';
    
    if (!type || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Path to en.js file - make sure we're using the absolute path
    console.log('Current directory:', dirname);
    const filePath = path.resolve(dirname, 'src', 'localization', 'rules', `${enforceEnglishLocale}.js`);
    console.log('Attempting to remove rule from file:', filePath);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ 
        success: false, 
        error: `Rules file not found: ${err.message}` 
      });
    }
    
    // Read the file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract the rule array
    const ruleRegex = new RegExp(`${type}:\\s*\\[([\\s\\S]*?)\\]`);
    const match = content.match(ruleRegex);
    
    if (!match) {
      return res.status(400).json({ error: `Could not find ${type} in the file` });
    }
    
    // Extract existing items
    let existingItems = match[1].split(',')
      .map(item => item.trim().replace(/"/g, '').replace(/'/g, ''))
      .filter(item => item.length > 0);
    
    // Check if item exists
    if (!existingItems.includes(name)) {
      return res.status(400).json({ error: `"${name}" does not exist in ${type}` });
    }
    
    // Remove the item
    existingItems = existingItems.filter(item => item !== name);
    
    // Format the new array
    const formattedArray = existingItems
      .map(item => `    "${item}"`)
      .join(',\n');
    
    // Create the new content
    const newContent = content.replace(
      ruleRegex,
      `${type}: [\n${formattedArray}\n  ]`
    );
    
    // Write the updated content back to the file
    await fs.writeFile(filePath, newContent, 'utf8');
    
    res.status(200).json({ success: true, message: `Successfully removed "${name}" from ${type}.` });
  } catch (error) {
    console.error('Error removing rule:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to remove rule: ${error.message}` 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: `Internal server error: ${err.message}` 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints: 
  - POST /api/update-rules
  - POST /api/remove-rule`);
});
