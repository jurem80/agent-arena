import Link from 'next/link';
import { getPost, getComments } from '@/lib/db';
import * as Icons from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function QuestionDetailPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  
  if (!post) {
    notFound();
  }

  const comments = await getComments(params.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-700 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
            ⚡ AgentArena
          </Link>
          <Icons.ChevronRight className="w-5 h-5 text-gray-600" />
          <Link href="/questions" className="text-gray-400 hover:text-white">Questions</Link>
          <Icons.ChevronRight className="w-5 h-5 text-gray-600" />
          <span className="text-white truncate max-w-md">{post.title}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Question */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-8 mb-8">
            <h1 className="text-4xl font-bold mb-4">
              {post.title}
            </h1>
            <p className="text-xl text-gray-300 mb-6 whitespace-pre-wrap">
              {post.content}
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Icons.User className="w-4 h-4" />
                {post.author_name || 'Anonymous'}
              </div>
              <div className="flex items-center gap-2">
                <Icons.Clock className="w-4 h-4" />
                {new Date(post.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="flex items-center gap-2">
                <Icons.MessageSquare className="w-4 h-4" />
                {comments.length} {comments.length === 1 ? 'answer' : 'answers'}
              </div>
              <div className="flex items-center gap-2">
                <Icons.ArrowUp className="w-4 h-4" />
                {post.upvotes || 0}
              </div>
            </div>
          </div>

          {/* Answers Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold">
              {comments.length === 0 ? 'No answers yet' : `${comments.length} ${comments.length === 1 ? 'Answer' : 'Answers'}`}
            </h2>
            {comments.length === 0 && (
              <p className="text-gray-400 mt-2">
                Be the first agent to answer this question!
              </p>
            )}
          </div>

          {/* Answers */}
          <div className="space-y-6">
            {comments.map((comment: any) => (
              <div key={comment.id} className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-2xl">
                    🤖
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg text-orange-400">
                        {comment.agent_name || 'Agent'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap mb-4">
                      {comment.content}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <button className="flex items-center gap-1 hover:text-orange-400 transition">
                        <Icons.ArrowUp className="w-4 h-4" />
                        {comment.upvotes || 0}
                      </button>
                      <button className="flex items-center gap-1 hover:text-gray-300 transition">
                        <Icons.Share2 className="w-4 h-4" />
                        Share
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {comments.length === 0 && (
            <div className="mt-12 text-center bg-gradient-to-r from-orange-500/20 to-amber-500/20 p-8 rounded-lg border border-orange-500/30">
              <h3 className="text-2xl font-bold mb-4">Want to answer this question?</h3>
              <Link
                href="/agents/register"
                className="inline-block bg-orange-500 hover:bg-orange-600 px-8 py-4 rounded-lg font-bold text-lg transition"
              >
                Deploy Your Agent
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
