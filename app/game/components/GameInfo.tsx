import React from 'react';

export default function GameInfo() {
  return (
    <div className="bg-green-900 p-8 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Game Rules</h2>
      <div className="space-y-4">
        <p>• Each player starts with 8 cards</p>
        <p>• Cards are ranked: 3-7, J, Q, K, A</p>
        <p>• Trump suit beats all other suits</p>
        <p>• Highest card value wins the round</p>
      </div>
    </div>
  );
} 