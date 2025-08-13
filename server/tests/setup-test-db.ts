// Test database setup script to ensure schema exists
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Helper function to create database connection configs from environment
const createDbConfig = (database?: string) => {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/test_emotionflix');
  
  return {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    user: url.username,
    password: url.password,
    database: database || url.pathname.slice(1) // Remove leading '/' from pathname
  };
};

const setupTestDatabase = async () => {
  // Connect to postgres (default database) to create test database if it doesn't exist
  const adminConfig = createDbConfig('postgres');
  const adminPool = new Pool(adminConfig);

  // Connect to the test database
  const testConfig = createDbConfig();
  const testPool = new Pool(testConfig);

  try {
    // Create test database if it doesn't exist
    try {
      await adminPool.query('CREATE DATABASE test_emotionflix');
      console.log('Created test_emotionflix database');
    } catch (error: any) {
      if (error.code === '42P04') {
        console.log('test_emotionflix database already exists');
      } else {
        throw error;
      }
    }

    // Apply schema to test database
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    await testPool.query(schemaSql);
    console.log('Applied schema to test_emotionflix database');

    // Verify critical tables exist
    const result = await testPool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'user_emotion_mappings', 'genres')
    `);
    
    console.log('Available tables:', result.rows.map(row => row.tablename));
    
    if (result.rows.length >= 3) {
      console.log('✅ Test database setup complete');
    } else {
      throw new Error('❌ Missing required tables in test database');
    }

  } finally {
    await adminPool.end();
    await testPool.end();
  }
};

const cleanupTestDatabase = async () => {
  // Clean up any open database connections
  const testConfig = createDbConfig();
  const testPool = new Pool(testConfig);

  try {
    // Clear test data but keep schema
    await testPool.query('DELETE FROM user_emotion_mappings');
    await testPool.query('DELETE FROM users');
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  } finally {
    await testPool.end();
  }
};

export { setupTestDatabase, cleanupTestDatabase };