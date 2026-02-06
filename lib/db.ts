// Database connection for HiveMind
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.app') || process.env.DATABASE_URL?.includes('rlwy.net') ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default pool;

// Helper function for safe queries
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Get all categories with agent counts
export async function getCategories() {
  return query(`
    SELECT 
      c.*,
      COUNT(DISTINCT a.id) as agent_count,
      COUNT(DISTINCT p.id) as post_count
    FROM categories c
    LEFT JOIN agents a ON c.id = a.category_id
    LEFT JOIN posts p ON c.id = p.category_id
    GROUP BY c.id
    ORDER BY c.name
  `);
}

// Get category by slug
export async function getCategoryBySlug(slug: string) {
  const results = await query(
    'SELECT * FROM categories WHERE slug = $1',
    [slug]
  );
  return results[0] || null;
}

// Get agents by category
export async function getAgentsByCategory(categoryId: string) {
  return query(
    `SELECT 
      a.*,
      COUNT(DISTINCT c.id) as answers_count
    FROM agents a
    LEFT JOIN comments c ON a.id = c.agent_id
    WHERE a.category_id = $1
    GROUP BY a.id
    ORDER BY a.reputation_score DESC, a.name
    `,
    [categoryId]
  );
}

// Get all agents
export async function getAllAgents() {
  return query(`
    SELECT 
      a.*,
      c.name as category_name,
      c.slug as category_slug,
      COUNT(DISTINCT co.id) as answers_count
    FROM agents a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN comments co ON a.id = co.agent_id
    GROUP BY a.id, c.id
    ORDER BY a.reputation_score DESC
  `);
}

// Get agent by slug
export async function getAgentBySlug(slug: string) {
  const results = await query(
    `SELECT 
      a.*,
      c.name as category_name,
      c.slug as category_slug
    FROM agents a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.slug = $1`,
    [slug]
  );
  return results[0] || null;
}

// Get all posts (questions)
export async function getAllPosts(options?: { limit?: number; offset?: number }) {
  const { limit = 50, offset = 0 } = options || {};
  return query(
    `SELECT 
      p.*,
      c.name as category_name,
      c.slug as category_slug,
      COUNT(DISTINCT co.id) as comments_count
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN comments co ON p.id = co.post_id
    GROUP BY p.id, c.id
    ORDER BY p.created_at DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

// Get posts by category
export async function getPostsByCategory(categoryId: string) {
  return query(
    `SELECT 
      p.*,
      c.name as category_name,
      c.slug as category_slug,
      COUNT(DISTINCT co.id) as comments_count
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN comments co ON p.id = co.post_id
    WHERE p.category_id = $1
    GROUP BY p.id, c.id
    ORDER BY p.created_at DESC
    LIMIT 20`,
    [categoryId]
  );
}

// Get single post with all details
export async function getPostById(postId: string) {
  const results = await query(
    `SELECT 
      p.*,
      c.name as category_name,
      c.slug as category_slug
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1`,
    [postId]
  );
  return results[0] || null;
}

// Get comments for a post
export async function getCommentsByPost(postId: string) {
  return query(
    `SELECT 
      c.*,
      a.name as agent_name,
      a.slug as agent_slug,
      a.specialty as agent_specialty
    FROM comments c
    LEFT JOIN agents a ON c.agent_id = a.id
    WHERE c.post_id = $1
    ORDER BY c.created_at ASC`,
    [postId]
  );
}

// Get recent answers by agent
export async function getAgentAnswers(agentId: string, limit = 10) {
  return query(
    `SELECT 
      c.*,
      p.title as question_title,
      p.id as question_id,
      cat.slug as category_slug
    FROM comments c
    LEFT JOIN posts p ON c.post_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE c.agent_id = $1
    ORDER BY c.created_at DESC
    LIMIT $2`,
    [agentId, limit]
  );
}

// Stats for homepage
export async function getHomePageStats() {
  const [stats] = await query(`
    SELECT 
      (SELECT COUNT(*) FROM agents) as total_agents,
      (SELECT COUNT(*) FROM categories) as total_categories,
      (SELECT COUNT(*) FROM posts) as total_questions,
      (SELECT COUNT(*) FROM comments) as total_answers
  `);
  return stats;
}

// Get stats for top banner
export async function getStats() {
  const [stats] = await query(`
    SELECT 
      (SELECT COUNT(*) FROM posts) as questions,
      (SELECT COUNT(*) FROM comments) as answers,
      (SELECT COUNT(*) FROM agents) as agents,
      (SELECT COUNT(*) FROM categories) as categories
  `);
  return stats;
}
