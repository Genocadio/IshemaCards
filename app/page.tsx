import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-green-800 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold">Card Duel</h1>
        <p className="text-xl">
          A 2-player card game where you battle against the AI in a test of strategy.
        </p>
        <div className="text-left bg-green-900 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Game Rules:</h2>
          <ul className="space-y-2">
            <li>• 36 cards (9 values × 4 suits)</li>
            <li>• Each player gets 18 cards</li>
            <li>• One suit is randomly chosen as trump</li>
            <li>• Players play one card each per round</li>
            <li>• Trump cards beat non-trump cards</li>
            <li>• If both or neither are trump, higher value wins</li>
            <li>• Winner of the most rounds wins the game</li>
          </ul>
        </div>
        <Link href="/game" className="inline-block bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-lg text-xl">
          Play Now
        </Link>
      </div>
    </div>
  );
}
