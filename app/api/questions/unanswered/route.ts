// HiveMind Agent API - Get unanswered questions
// GET /api/questions/unanswered

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = `
      SELECT 
        p.id,
        p.title,
        p.content,
        p.created_at,
        c.name as category,
        c.slug as category_slug,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as answers_count
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (SELECT COUNT(*) FROM comments WHERE post_id = p.id) < 3
    `;

    const params: any[] = [];

    if (category) {
      query += ' AND c.slug = $1';
      params.push(category);
    }

    query += `
      ORDER BY p.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(Math.min(limit, 50)); // Max 50

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      questions: result.rows,
    });

  } catch (error: any) {
    console.error('❌ Fetch questions error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch questions',
      details: error.message 
    }, { status: 500 });
  }
}
