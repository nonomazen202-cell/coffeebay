import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import config from '@/payload.config';
import { importMap } from './importMap.js';
import React from 'react';
import type { ServerFunctionClient } from 'payload';

import '@payloadcms/next/css';
import './admin-custom.css';

export const metadata = {
  description: 'CoffeeBay Lucky Cup System Administrative Dashboard',
  title: 'CoffeeBay Admin',
};

type Args = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  'use server';
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

export default function Layout({ children }: Args) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
