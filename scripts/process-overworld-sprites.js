/**
 * Process Pokemon Overworld Sprites
 * 
 * Converts individual overworld sprite GIFs into sprite sheets (4x4 grid)
 * similar to the player character format (perso_masculino.webp)
 * 
 * Input: Individual GIF files organized by Pokemon ID and direction
 * Output: Sprite sheet PNG files (4 rows x 4 columns)
 * 
 * Usage:
 * node scripts/process-overworld-sprites.js --input ./overworld_input --output ./overworld_output
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Sprite sheet layout: 4 rows (down, left, right, up) x 4 columns (walk frames)
const DIRECTIONS = ['down', 'left', 'right', 'up'];
const FRAMES_PER_DIRECTION = 4;
const SHEET_SIZE = 256; // Output size (same as player sprite)
const FRAME_SIZE = SHEET_SIZE / 4; // 64x64 per frame

async function processOverworldSprites(inputDir, outputDir) {
  console.log('Processing overworld sprites...');
  console.log(`Input: ${inputDir}`);
  console.log(`Output: ${outputDir}`);
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Find all Pokemon directories
  const pokemonDirs = fs.readdirSync(inputDir).filter(d => {
    const fullPath = path.join(inputDir, d);
    return fs.statSync(fullPath).isDirectory();
  });
  
  console.log(`Found ${pokemonDirs.length} Pokemon to process`);
  
  for (const pokemonDir of pokemonDirs) {
    try {
      await processPokemon(pokemonDir, inputDir, outputDir);
    } catch (error) {
      console.error(`Error processing ${pokemonDir}:`, error.message);
    }
  }
  
  console.log('Processing complete!');
}

async function processPokemon(pokemonId, inputDir, outputDir) {
  const pokemonPath = path.join(inputDir, pokemonId);
  
  // Look for sprite files (multiple naming conventions)
  const spriteFiles = [];
  
  for (const direction of DIRECTIONS) {
    // Try different file naming patterns
    const patterns = [
      `${pokemonId}_${direction}.gif`,
      `${direction}.gif`,
      `${pokemonId}/${direction}.gif`,
      `${direction}/${pokemonId}.gif`
    ];
    
    let found = false;
    for (const pattern of patterns) {
      const filePath = path.join(pokemonPath, pattern);
      if (fs.existsSync(filePath)) {
        spriteFiles.push({ direction, path: filePath });
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.warn(`Missing direction ${direction} for Pokemon ${pokemonId}`);
    }
  }
  
  if (spriteFiles.length < 4) {
    console.warn(`Skipping Pokemon ${pokemonId}: only ${spriteFiles.length} directions found`);
    return;
  }
  
  // Create sprite sheet
  const sheet = createCanvas(SHEET_SIZE, SHEET_SIZE);
  const ctx = sheet.getContext('2d');
  
  // Load and process each direction
  for (let dirIndex = 0; dirIndex < DIRECTIONS.length; dirIndex++) {
    const direction = DIRECTIONS[dirIndex];
    const spriteFile = spriteFiles.find(f => f.direction === direction);
    
    if (spriteFile) {
      try {
        const sprite = await loadImage(spriteFile.path);
        
        // Calculate frame positions (assuming 4 frames in the source)
        const frameWidth = sprite.width / FRAMES_PER_DIRECTION;
        
        for (let frame = 0; frame < FRAMES_PER_DIRECTION; frame++) {
          const destX = frame * FRAME_SIZE;
          const destY = dirIndex * FRAME_SIZE;
          
          // Draw frame from source to destination
          ctx.drawImage(
            sprite,
            frame * frameWidth, 0, frameWidth, sprite.height,
            destX, destY, FRAME_SIZE, FRAME_SIZE
          );
        }
      } catch (error) {
        console.error(`Error loading sprite for ${direction}:`, error.message);
      }
    }
  }
  
  // Save output
  const outputPath = path.join(outputDir, `${pokemonId}.png`);
  const buffer = sheet.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`Processed Pokemon ${pokemonId} -> ${outputPath}`);
}

// Export for use in other scripts
module.exports = { processOverworldSprites, DIRECTIONS, FRAMES_PER_DIRECTION, SHEET_SIZE, FRAME_SIZE };

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  
  if (inputIndex === -1 || outputIndex === -1) {
    console.log('Usage: node process-overworld-sprites.js --input ./input --output ./output');
    process.exit(1);
  }
  
  const inputDir = args[inputIndex + 1];
  const outputDir = args[outputIndex + 1];
  
  processOverworldSprites(inputDir, outputDir).catch(console.error);
}
