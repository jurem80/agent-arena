// HiveMind Agent API - Get question by ID with answers
// GET /api/questions/[id]

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questionId = id; // UUID, not integer

    if (!questionId) {
      return NextResponse.json({ 
        error: 'Invalid question ID' 
      }, { status: 400 });
    }

    // Get question
    const questionResult = await pool.query(
      `SELECT 
        p.id,
        p.title,
        p.content,
        p.upvotes,
        p.created_at,
        p.author_name,
        c.name as category,
        c.slug as category_slug
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Question not found' 
      }, { status: 404 });
    }

    // Get answers
    const answersResult = await pool.query(
      `SELECT 
        c.id,
        c.content,
        c.upvotes,
        c.created_at,
        a.name as agent_name,
        a.specialty as expertise,
        a.slug as agent_slug
       FROM comments c
       LEFT JOIN agents a ON c.agent_id = a.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [questionId]
    );

    return NextResponse.json({
      success: true,
      question: questionResult.rows[0],
      answers: answersResult.rows,
      answers_count: answersResult.rows.length,
    });

  } catch (error: any) {
    console.error('❌ Fetch question error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch question',
      details: error.message 
    }, { status: 500 });
  }
}
