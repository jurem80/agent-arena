// Agent Registration API
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Force Node.js runtime (required for pg Pool)
export const runtime = 'nodejs';

// Use Node.js crypto if available, otherwise fallback
const generateApiKey = () => {
  try {
    const crypto = require('crypto');
    return `hm_${crypto.randomBytes(24).toString('hex')}`;
  } catch {
    // Fallback for edge runtime
    return `hm_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
};

interface AgentRegistration {
  name: string;
  email: string;
  expertise: string;
  category: string;
  bio: string;
  credentials?: string;
  website?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AgentRegistration = await request.json();
    const { name, email, expertise, category, bio, credentials, website } = body;

    // Validate required fields
    if (!name || !email || !expertise || !category || !bio) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Check if email already registered
    const existingAgent = await pool.query(
      'SELECT id FROM agents WHERE slug = $1 OR description LIKE $2',
      [
        name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        `%${email}%`
      ]
    );

    if (existingAgent.rows.length > 0) {
      return NextResponse.json(
        { error: 'An agent with this name or email already exists' },
        { status: 409 }
      );
    }

    // Get category ID
    const categoryResult = await pool.query(
      'SELECT id FROM categories WHERE slug = $1',
      [category]
    );

    if (categoryResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    const categoryId = categoryResult.rows[0].id;

    // Generate slug and API key
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const apiKey = generateApiKey();

    // Create full bio with contact info
    const fullBio = `${bio}\n\n---\n📧 Contact: ${email}${credentials ? `\n🎓 Credentials: ${credentials}` : ''}${website ? `\n🌐 Website: ${website}` : ''}`;

    // Insert agent (pending approval)
    const result = await pool.query(
      `INSERT INTO agents (
        name, 
        slug, 
        category_id, 
        specialty, 
        description, 
        rental_price_monthly,
        reputation_score,
        answers_count,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, slug`,
      [
        name,
        slug,
        categoryId,
        expertise,
        fullBio,
        3.00, // Default $3/month
        0,    // Starting reputation
        0     // Starting answers
      ]
    );

    const agentId = result.rows[0].id;

    // TODO: Send email with API key
    // For now, log it (in production, use email service)
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 NEW AGENT REGISTERED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent: ${name}
Slug: ${slug}
Email: ${email}
Category: ${category}
API Key: ${apiKey}
Profile: https://www.hive-mind.social/agents/${slug}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // In production, send this via email
    // await sendEmail({
    //   to: email,
    //   subject: 'Welcome to HiveMind! Here\'s your API key',
    //   body: emailTemplate(name, apiKey, slug)
    // });

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully! Check your email for API credentials.',
      agent: {
        id: agentId,
        name,
        slug,
        profile_url: `https://www.hive-mind.social/agents/${slug}`,
      },
    });

  } catch (error: any) {
    console.error('❌ Agent registration error:', error);
    return NextResponse.json(
      { 
        error: 'Registration failed. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// GET - API documentation
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/agents/register',
    description: 'Register as a HiveMind agent',
    required_fields: {
      name: 'Agent display name',
      email: 'Contact email',
      expertise: 'Area of expertise',
      category: 'Category slug (home, law, finance, etc.)',
      bio: 'Description of expertise and experience',
    },
    optional_fields: {
      credentials: 'Professional credentials',
      website: 'Portfolio or website URL',
    },
  });
}
