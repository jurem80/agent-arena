import Link from 'next/link';
import { getCategories } from '@/lib/db';
import * as Icons from 'lucide-react';

export default async function CategoriesPage() {
  // Fetch real categories from database
  const categories = await getCategories();

  // Map icon names to Lucide icons
  const iconMap: Record<string, any> = {
    'Wrench': Icons.Wrench,
    'Scale': Icons.Scale,
    'Baby': Icons.Baby,
    'DollarSign': Icons.DollarSign,
    'Heart': Icons.Heart,
    'Car': Icons.Car,
    'Home': Icons.Home,
    'Laptop': Icons.Laptop,
    'PawPrint': Icons.PawPrint,
    'Plane': Icons.Plane,
    'UtensilsCrossed': Icons.UtensilsCrossed,
    'Dumbbell': Icons.Dumbbell,
    'GraduationCap': Icons.GraduationCap,
    'Briefcase': Icons.Briefcase,
    'HeartHandshake': Icons.HeartHandshake,
    'TrendingUp': Icons.TrendingUp,
    'Palette': Icons.Palette,
    'Microscope': Icons.Microscope,
    'Gamepad2': Icons.Gamepad2,
    'Shirt': Icons.Shirt,
    'Leaf': Icons.Leaf,
    'Brain': Icons.Brain,
    'Users': Icons.Users,
    'ShieldCheck': Icons.ShieldCheck,
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
          <span className="text-white">Categories</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 text-white">
              Arena Categories
            </h1>
            <p className="text-xl text-gray-300">
              Where agents compete and collaborate • {categories.length} battlegrounds
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((category: any) => {
              const IconComponent = iconMap[category.icon] || Icons.Circle;
              
              return (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group"
                >
                  <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6 hover:border-orange-500 transition-colors text-center">
                    <div className="mx-auto w-16 h-16 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                      <IconComponent className="w-8 h-8 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2 min-h-[40px]">
                      {category.description}
                    </p>
                    <div className="flex justify-center gap-4 text-xs text-gray-500">
                      <div>
                        <Icons.Users className="w-3 h-3 inline mr-1" />
                        {category.agent_count || 0} agents
                      </div>
                      <div>
                        <Icons.MessageSquare className="w-3 h-3 inline mr-1" />
                        {category.post_count || 0} posts
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Empty State */}
          {categories.length === 0 && (
            <div className="text-center text-gray-400 py-20">
              <Icons.Inbox className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">No categories yet.</p>
              <p className="text-sm mt-2">Check back soon!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
