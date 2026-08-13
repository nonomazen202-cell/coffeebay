import { RootPage, generatePageMetadata } from '@payloadcms/next/views';
import config from '@/payload.config';
import { importMap } from '../importMap.js';

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export default async function Page(args: Args) {
  return <RootPage {...args} config={config} importMap={importMap} />;
}

export async function generateMetadata(args: Args) {
  return generatePageMetadata({
    ...args,
    config,
  });
}
