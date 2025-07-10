import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// Setup Express server
const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`[${new Date().toISOString()}] Response:`, body);
    return originalSend.call(this, body);
  };
  
  next();
});

// Serve static files
app.use(express.static('./'));

// API health check endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API server is running correctly' });
});

// Add new rule to English locale
app.post('/api/update-rules', async (req, res) => {
  try {
    const { type, name } = req.body;
    const enforceEnglishLocale = 'en';
    
    if (!type || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const validRuleTypes = ['appleServices', 'appGameNames'];
    if (!validRuleTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid rule type. Only appleServices and appGameNames are supported.' });
    }
    
    // Get path to rules file and verify it exists
    const filePath = path.resolve(dirname, 'src', 'localization', 'rules', `${enforceEnglishLocale}.js`);
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ 
        success: false, 
        error: `Rules file not found: ${err.message}` 
      });
    }
    
    // Read and parse file content
    const content = await fs.readFile(filePath, 'utf8');
    const ruleRegex = new RegExp(`${type}:\\s*\\[([\\s\\S]*?)\\]`);
    const match = content.match(ruleRegex);
    
    if (!match) {
      return res.status(400).json({ error: `Could not find ${type} in the file` });
    }
    
    // Process the rules array
    const existingItems = match[1].split(',')
      .map(item => item.trim().replace(/"/g, '').replace(/'/g, ''))
      .filter(item => item.length > 0);
    
    if (existingItems.includes(name)) {
      return res.status(400).json({ error: `"${name}" already exists in ${type}` });
    }
    
    // Update the rules array
    existingItems.push(name);
    const formattedArray = existingItems
      .map(item => `    "${item}"`)
      .join(',\n');
    
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

// Remove rule from English locale
app.post('/api/remove-rule', async (req, res) => {
  try {
    const { type, name } = req.body;
    const enforceEnglishLocale = 'en';
    
    if (!type || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get path to rules file and verify it exists
    const filePath = path.resolve(dirname, 'src', 'localization', 'rules', `${enforceEnglishLocale}.js`);
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

// Global error handler
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
  console.log(`API endpoints available: /api/test, /api/update-rules, /api/remove-rule`);
});
