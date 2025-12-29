#!/usr/bin/env node
/**
 * Asset Validation Script
 *
 * Validates audio assets against AUDIO.md specifications.
 * Exit codes: 0 = pass, 1 = error (blocking), 2 = warning
 *
 * Usage:
 *   node validate-assets.js [--force] [--warn-only]
 *
 * Options:
 *   --force      Continue build even on errors (escape hatch)
 *   --warn-only  Report issues as warnings instead of errors
 *
 * Configuration: asset-validation.config.json
 */

const fs = require('fs');
const path = require('path');

// Default configuration (overridden by config file)
const DEFAULT_CONFIG = {
  audioDir: 'public/audio',
  requiredSfx: [
    'menu_move',
    'menu_select',
    'menu_back',
    'menu_error',
    'choice_hover',
    'choice_select',
    'page_turn',
    'inventory_open',
    'inventory_close',
    'item_pickup',
    'item_use',
    'save',
    'load',
    'stat_up',
    'stat_down',
    'game_over',
    'victory'
  ],
  requiredMusic: [
    'title',
    'exploration',
    'tension',
    'victory',
    'defeat'
  ],
  limits: {
    sfxMaxSizeKB: 100,
    musicMaxSizeMB: 2
  },
  allowedFormats: ['.ogg'],
  fallbackFormats: ['.mp3']
};

// Parse command line arguments
const args = process.argv.slice(2);
const forceMode = args.includes('--force');
const warnOnly = args.includes('--warn-only');

// Load configuration
function loadConfig() {
  const configPath = path.join(process.cwd(), 'asset-validation.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...userConfig, limits: { ...DEFAULT_CONFIG.limits, ...userConfig.limits } };
    } catch (e) {
      console.error(`[ERROR] Failed to parse config file: ${e.message}`);
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

// Validation result tracking
const results = {
  errors: [],
  warnings: []
};

function error(msg) {
  results.errors.push(msg);
  console.error(`[ERROR] ${msg}`);
}

function warn(msg) {
  results.warnings.push(msg);
  console.warn(`[WARN] ${msg}`);
}

function info(msg) {
  console.log(`[INFO] ${msg}`);
}

// Check if file exists with any allowed format
function findAssetFile(dir, baseName, formats) {
  for (const ext of formats) {
    const filePath = path.join(dir, `${baseName}${ext}`);
    if (fs.existsSync(filePath)) {
      return { path: filePath, format: ext };
    }
  }
  return null;
}

// Get file size in bytes
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (e) {
    return 0;
  }
}

// Validate SFX files
function validateSfx(config) {
  const sfxDir = path.join(process.cwd(), config.audioDir, 'sfx');
  const allFormats = [...config.allowedFormats, ...config.fallbackFormats];
  const maxSize = config.limits.sfxMaxSizeKB * 1024;

  info(`Validating SFX in ${sfxDir}`);

  for (const sfxName of config.requiredSfx) {
    const asset = findAssetFile(sfxDir, sfxName, allFormats);

    if (!asset) {
      error(`Missing required SFX: ${sfxName} (expected ${config.allowedFormats.join(' or ')})`);
      continue;
    }

    // Check format preference
    if (!config.allowedFormats.includes(asset.format)) {
      warn(`SFX ${sfxName} uses fallback format ${asset.format} instead of ${config.allowedFormats[0]}`);
    }

    // Check file size
    const size = getFileSize(asset.path);
    if (size > maxSize) {
      error(`SFX ${sfxName}${asset.format} exceeds size limit: ${(size/1024).toFixed(1)}KB > ${config.limits.sfxMaxSizeKB}KB`);
    }
  }
}

// Validate music files
function validateMusic(config) {
  const musicDir = path.join(process.cwd(), config.audioDir, 'music');
  const allFormats = [...config.allowedFormats, ...config.fallbackFormats];
  const maxSize = config.limits.musicMaxSizeMB * 1024 * 1024;

  info(`Validating music in ${musicDir}`);

  for (const trackName of config.requiredMusic) {
    const asset = findAssetFile(musicDir, trackName, allFormats);

    if (!asset) {
      error(`Missing required music: ${trackName} (expected ${config.allowedFormats.join(' or ')})`);
      continue;
    }

    // Check format preference
    if (!config.allowedFormats.includes(asset.format)) {
      warn(`Music ${trackName} uses fallback format ${asset.format} instead of ${config.allowedFormats[0]}`);
    }

    // Check file size
    const size = getFileSize(asset.path);
    if (size > maxSize) {
      error(`Music ${trackName}${asset.format} exceeds size limit: ${(size/1024/1024).toFixed(2)}MB > ${config.limits.musicMaxSizeMB}MB`);
    }
  }
}

// Check for unexpected files (wrong format, unknown assets)
function validateExtraFiles(config) {
  const audioDir = path.join(process.cwd(), config.audioDir);
  const allFormats = [...config.allowedFormats, ...config.fallbackFormats];

  const subdirs = ['sfx', 'music', 'ambience'];

  for (const subdir of subdirs) {
    const dir = path.join(audioDir, subdir);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      // Skip gitkeep and hidden files
      if (file.startsWith('.')) continue;

      const ext = path.extname(file).toLowerCase();

      // Check for disallowed formats
      if (ext && !allFormats.includes(ext)) {
        warn(`Unexpected format in ${subdir}/${file}: ${ext} (expected ${allFormats.join(', ')})`);
      }

      // Check naming convention (lowercase with underscores)
      const baseName = path.basename(file, ext);
      if (baseName !== baseName.toLowerCase() || baseName.includes(' ') || baseName.includes('-')) {
        warn(`Naming convention violation: ${file} (use lowercase with underscores)`);
      }
    }
  }
}

// Check folder structure exists
function validateFolderStructure(config) {
  const audioDir = path.join(process.cwd(), config.audioDir);
  const requiredDirs = ['sfx', 'music', 'ambience'];

  info(`Checking folder structure in ${audioDir}`);

  if (!fs.existsSync(audioDir)) {
    error(`Audio directory does not exist: ${audioDir}`);
    return false;
  }

  for (const dir of requiredDirs) {
    const dirPath = path.join(audioDir, dir);
    if (!fs.existsSync(dirPath)) {
      error(`Missing audio subdirectory: ${dir}/`);
    }
  }

  return true;
}

// Main validation
function main() {
  console.log('');
  console.log('========================================');
  console.log('  Audio Asset Validation');
  console.log('========================================');
  console.log('');

  if (forceMode) {
    console.log('[MODE] Force mode enabled - errors will not block build');
  }
  if (warnOnly) {
    console.log('[MODE] Warn-only mode - all issues reported as warnings');
  }
  console.log('');

  const config = loadConfig();

  // Run validations
  if (!validateFolderStructure(config)) {
    // Folder structure missing - stop here
  } else {
    validateSfx(config);
    validateMusic(config);
    validateExtraFiles(config);
  }

  // Summary
  console.log('');
  console.log('========================================');
  console.log('  Validation Summary');
  console.log('========================================');
  console.log(`  Errors:   ${results.errors.length}`);
  console.log(`  Warnings: ${results.warnings.length}`);
  console.log('========================================');
  console.log('');

  // Determine exit code
  if (results.errors.length > 0) {
    if (forceMode) {
      console.log('[RESULT] Errors found but --force enabled. Continuing.');
      process.exit(0);
    } else if (warnOnly) {
      console.log('[RESULT] Errors treated as warnings. Continuing.');
      process.exit(2);
    } else {
      console.log('[RESULT] Validation FAILED. Use --force to override.');
      process.exit(1);
    }
  } else if (results.warnings.length > 0) {
    console.log('[RESULT] Validation passed with warnings.');
    process.exit(2);
  } else {
    console.log('[RESULT] Validation PASSED.');
    process.exit(0);
  }
}

main();
