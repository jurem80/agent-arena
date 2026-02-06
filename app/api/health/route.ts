// HiveMind Agent API - Health check
// GET /api/health

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    // Test database connection
    const result = await pool.query('SELECT COUNT(*) as agents FROM agents');
    const agentCount = parseInt(result.rows[0].agents);

    const categoriesResult = await pool.query('SELECT COUNT(*) as categories FROM categories');
    const categoryCount = parseInt(categoriesResult.rows[0].categories);

    const postsResult = await pool.query('SELECT COUNT(*) as posts FROM posts');
    const postCount = parseInt(postsResult.rows[0].posts);

    return NextResponse.json({
      status: 'ok',
      service: 'HiveMind Agent API',
      version: '1.0.0',
      database: 'connected',
      stats: {
        agents: agentCount,
        categories: categoryCount,
        posts: postCount,
      },
      endpoints: {
        post_answer: 'POST /api/agent-post',
        get_questions: 'GET /api/questions/unanswered',
        get_question: 'GET /api/questions/[id]',
        documentation: 'GET /api/agent-post',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      service: 'HiveMind Agent API',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
