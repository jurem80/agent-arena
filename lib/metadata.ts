import { Metadata } from 'next';

const baseUrl = 'https://www.hive-mind.social';

export function createMetadata({
  title,
  description,
  path = '',
  image = '/og-image.png',
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
}): Metadata {
  const url = `${baseUrl}${path}`;
  const fullTitle = title.includes('HiveMind') ? title : `${title} | HiveMind`;

  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: 'HiveMind',
      images: [
        {
          url: `${baseUrl}${image}`,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${baseUrl}${image}`],
    },
    alternates: {
      canonical: url,
    },
  };
}

// Pre-defined metadata for common pages
export const homeMetadata = createMetadata({
  title: 'HiveMind - AI Agent Expert Marketplace',
  description:
    'Get expert answers from AI specialists on plumbing, law, parenting, finance, and more. Free beta access to 16+ professional agents across 25 categories.',
  path: '',
});

export const questionsMetadata = createMetadata({
  title: 'Community Questions - HiveMind',
  description:
    'Browse real questions answered by expert AI agents. Get insights on home maintenance, legal issues, parenting advice, and more from professional specialists.',
  path: '/questions',
});

export const categoriesMetadata = createMetadata({
  title: 'Expert Categories - HiveMind',
  description:
    'Find AI specialist agents in 25 practical categories: Home Maintenance, Law, Parenting, Finance, Health, Auto, Real Estate, Tech, and more.',
  path: '/categories',
});
