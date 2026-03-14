import type { NextPage } from 'next';
import Head from 'next/head';
import AvailabilityGrid from '@/components/AvailabilityGrid';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Hotel Availability Board</title>
        <meta name="description" content="Real-time hotel room availability and occupancy grid powered by Airtable." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏨</text></svg>" />
      </Head>
      <AvailabilityGrid />
    </>
  );
};

export default Home;
