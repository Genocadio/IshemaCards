import React from 'react';

interface PostGameDialogProps {
  onPlayAgain: () => void;
  playerTotalValue: number;
  aiTotalValue: number;
  postGameQuestion: string;
  postGameAnswer: string;
  showPostGameQuestion: boolean;
  showPlayerQuestionInput: boolean;
  onPlayerQuestion: (text: string) => void;
  onPlayerAnswer: (text: string) => void;
}

export default function PostGameDialog({ 
  onPlayAgain,
  playerTotalValue,
  aiTotalValue,
  postGameQuestion,
  postGameAnswer,
  showPostGameQuestion,
  showPlayerQuestionInput,
  onPlayerQuestion,
  onPlayerAnswer
}: PostGameDialogProps) {
  const [playerInput, setPlayerInput] = React.useState('');

  const handleSubmit = () => {
    if (playerInput.trim()) {
      if (playerTotalValue > aiTotalValue) {
        onPlayerQuestion(playerInput);
      } else {
        onPlayerAnswer(playerInput);
      }
      setPlayerInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-green-900 p-6 rounded-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
        <p className="text-lg mb-4">Final Score: You {playerTotalValue} - {aiTotalValue} AI</p>

        {showPostGameQuestion && (
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">Post-Game Question</h3>
            <p className="mb-2">Q: {postGameQuestion}</p>
            {postGameAnswer && (
              <p className="text-yellow-300">A: {postGameAnswer}</p>
            )}
          </div>
        )}

        {showPlayerQuestionInput && (
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">
              {playerTotalValue > aiTotalValue ? 'Ask AI a Question' : 'Answer AI\'s Question'}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                placeholder={playerTotalValue > aiTotalValue ?
                  "Type your question..." :
                  "Type your answer..."}
                className="flex-1 px-3 py-2 rounded bg-green-800 text-white placeholder-green-400"
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                onClick={handleSubmit}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded"
              >
                {playerTotalValue > aiTotalValue ? 'Ask' : 'Answer'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded"
            onClick={onPlayAgain}
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
} 