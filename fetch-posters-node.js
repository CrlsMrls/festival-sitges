// Node.js script to fetch poster URLs from IMDb
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration - change this to the year you want to process
const YEAR = '2025';
const MOVIES_FILE = path.join(__dirname, YEAR, 'movies.json');

// Load sessions from JSON file
let sessions = [];
try {
  const data = fs.readFileSync(MOVIES_FILE, 'utf8');
  sessions = JSON.parse(data);
  console.log(`✓ Loaded ${sessions.length} movies from ${MOVIES_FILE}\n`);
} catch (error) {
  console.error(`✗ Error loading ${MOVIES_FILE}:`, error.message);
  process.exit(1);
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchPoster(session) {
  try {
    console.log(`Fetching: ${session.id}...`);
    
    const html = await fetchUrl(session.imdbURL);
    
    // regex to extract og:image content
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    
    if (match && match[1]) {
      const imageUrl = match[1];
      console.log(`✓ ${session.id}: Found poster`);
      return { id: session.id, posterURL: imageUrl };
    } else {
      console.log(`✗ ${session.id}: No poster found`);
      return { id: session.id, posterURL: null };
    }
  } catch (error) {
    console.log(`✗ ${session.id}: Error - ${error.message}`);
    return { id: session.id, posterURL: null };
  }
}

async function fetchAllPosters() {
  const results = [];
  
  console.log('Starting to fetch posters...');
  console.log('Fetching directly from IMDb (no proxy needed!)\n');
  
  for (const session of sessions) {
    const result = await fetchPoster(session);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('\n=== COMPLETED ===');
  console.log(`Found ${results.filter(r => r.posterURL).length} out of ${results.length} posters\n`);
  
  // Update the original sessions array with new poster URLs
  let updatedCount = 0;
  sessions.forEach(session => {
    const result = results.find(r => r.id === session.id);
    if (result && result.posterURL) {
      session.posterURL = result.posterURL;
      updatedCount++;
    }
  });
  
  // Save updated sessions back to the JSON file
  try {
    fs.writeFileSync(MOVIES_FILE, JSON.stringify(sessions, null, 2), 'utf8');
    console.log(`✓ Updated ${updatedCount} poster URLs in ${MOVIES_FILE}\n`);
  } catch (error) {
    console.error(`✗ Error saving file:`, error.message);
  }
  
  console.log('\n=== RESULTS ===\n');
  results.forEach(r => {
    if (r.posterURL) {
      console.log(`✓ ${r.id}: ${r.posterURL}`);
    } else {
      console.log(`✗ ${r.id}: No poster found`);
    }
  });
}

// Run the script
fetchAllPosters().catch(console.error);
