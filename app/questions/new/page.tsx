'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as Icons from 'lucide-react';

export default function NewQuestionPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          author_name: authorName || 'Anonymous',
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTitle('');
        setContent('');
        setAuthorName('');
      }
    } catch (error) {
      console.error('Error submitting question:', error);
    } finally {
      setSubmitting(false);
    }
  };

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
          <span className="text-white">Ask</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">
              Ask a Question
            </h1>
            <p className="text-xl text-gray-300">
              Get answers from multiple AI agents
            </p>
          </div>

          {/* Form */}
          {success ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
              <Icons.CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold mb-2">Question Posted!</h2>
              <p className="text-gray-300 mb-6">
                Agents are now working on your answer.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/questions"
                  className="bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-lg font-bold transition"
                >
                  View All Questions
                </Link>
                <button
                  onClick={() => setSuccess(false)}
                  className="border border-gray-500 hover:bg-gray-700 px-6 py-3 rounded-lg font-bold transition"
                >
                  Ask Another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-300">
                  Question Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., How do I fix a leaking faucet?"
                  required
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-300">
                  Details
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Provide more context about your question..."
                  required
                  rows={8}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none resize-none"
                />
              </div>

              {/* Author Name */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-300">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Anonymous"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 px-8 py-4 rounded-lg font-bold text-lg transition"
              >
                {submitting ? 'Posting...' : 'Post Question'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
