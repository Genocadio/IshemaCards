// Round Evaluator for Card Game

import { Card, Suit, CardValue, CardId, STATIC_CARDS } from '../types';

// Types for the round evaluator
export interface PlayerMove {
  playerId: string;
  card: Card;
  teamId: string;
  moveQuality?: number; // Rating from 0-10 for move quality
}

interface RoundResult {
  winningTeam: 'team1' | 'team2';
  winningPlayerId: string;
  pointsEarned: number; // Total card points earned in the round
  moveRatings: {
    playerId: string;
    moveQuality: number;
    reasoning: string;
  }[];
  overallRoundQuality: number; // Average of all move qualities
  roundAnalysis: string; // Textual analysis of the round
}

export class RoundEvaluator {
  private readonly CARD_POINT_VALUES: Record<CardValue, number> = {
    'A': 11,
    'K': 4,
    'Q': 2,
    'J': 3,
    '7': 10,
    '6': 0,
    '5': 0,
    '4': 0,
    '3': 0
  };
  
  private readonly TRUMP_BONUS = 20; // Only for comparison, not scoring
  private readonly MAJOR_SUIT_ORDER: Suit[] = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  private readonly logg: boolean = true; // Hardcoded logging flag

  // Track historical data for player performance analysis
  private playerHistory: Record<string, {
    totalMoves: number;
    goodMoves: number; // Moves rated 7+
    badMoves: number; // Moves rated 3 or below
    avgRating: number;
    trumpUsage: number;
  }> = {};

  // Track game state
  private currentRound: number = 0;
  private totalRounds: number = 0;
  private playedCards: Card[] = [];
  private playerCount: number;

  constructor(private trumpSuit: Suit, totalRounds: number = 8, playerCount: number = 2) {
    this.totalRounds = totalRounds;
    this.playerCount = playerCount;
  }

  private log(message: string, data?: any): void {
    if (this.logg) {
      console.log(`[Round ${this.currentRound}] ${message}`, data ? data : '');
    }
  }

  // Method to evaluate a complete round
  public evaluateRound(moves: PlayerMove[], roundStake: number = 0): RoundResult {
    this.currentRound++;
    this.log(`Starting round evaluation. Player count: ${this.playerCount}`);
    
    // Add played cards to history
    moves.forEach(move => {
      this.playedCards.push(move.card);
    });
    this.log('Cards played this round:', moves.map(m => `${m.playerId}: ${m.card.value} of ${m.card.suit}`));

    // Check for special first round wins (only for 4 or 6 players)
    if (this.currentRound === 1 && (this.playerCount === 4 || this.playerCount === 6)) {
      this.log('Checking for special first round wins');
      const specialWinInfo = this.checkFirstRoundSpecialWin(moves);
      if (specialWinInfo.isSpecialWin) {
        this.log('Special first round win detected:', specialWinInfo);
        // Adjust points for special win
        const pointsEarned = this.calculateRoundPoints(moves) + roundStake + specialWinInfo.bonusPoints;
        
        // Generate move ratings with special win consideration
        const moveRatings = moves.map(move => {
          const baseRating = this.rateSingleMove(move, moves);
          return {
            playerId: move.playerId,
            moveQuality: baseRating.quality,
            reasoning: baseRating.reasoning + ' ' + specialWinInfo.reasoning
          };
        });

        this.log('Round evaluation complete with special win');
        return {
          winningTeam: specialWinInfo.winningTeam,
          winningPlayerId: specialWinInfo.winningPlayerId,
          pointsEarned,
          moveRatings,
          overallRoundQuality: this.calculateOverallRoundQuality(moveRatings),
          roundAnalysis: `First round special win: ${specialWinInfo.reasoning}`
        };
      }
    }

    // Group moves by teams if there are more than 2 cards
    const teamMoves: Record<string, PlayerMove[]> = {};
    moves.forEach(move => {
      if (!teamMoves[move.teamId]) {
        teamMoves[move.teamId] = [];
      }
      teamMoves[move.teamId].push(move);
    });
    this.log('Moves grouped by teams:', teamMoves);

    const teamIds = Object.keys(teamMoves);
    
    // Rate individual moves
    this.log('Rating individual moves');
    const ratedMoves = moves.map(move => {
      const moveRating = this.rateSingleMove(move, moves);
      this.log(`Move rating for ${move.playerId}:`, moveRating);
      return {
        ...move,
        moveQuality: moveRating.quality
      };
    });

    // Determine the winning move and team
    this.log('Determining winning team');
    const winningTeamInfo = this.determineWinningTeam(teamMoves);
    this.log('Winning team determined:', winningTeamInfo);

    // Calculate points earned
    const pointsEarned = this.calculateRoundPoints(moves) + roundStake;
    this.log('Points earned:', pointsEarned);

    // Generate detailed analysis for each move
    this.log('Generating move ratings');
    const moveRatings = ratedMoves.map(move => {
      const rating = {
        playerId: move.playerId,
        moveQuality: move.moveQuality || 0,
        reasoning: this.generateMoveReasoning(move, moves, winningTeamInfo.winningPlayerId)
      };
      this.log(`Move rating for ${move.playerId}:`, rating);
      return rating;
    });

    // Calculate overall round quality
    const overallRoundQuality = this.calculateOverallRoundQuality(moveRatings);
    this.log('Overall round quality:', overallRoundQuality);

    // Update player history
    this.log('Updating player history');
    this.updatePlayerHistory(moveRatings);

    // Generate round analysis
    this.log('Generating round analysis');
    const roundAnalysis = this.generateRoundAnalysis(moves, winningTeamInfo, moveRatings, pointsEarned);
    this.log('Round analysis:', roundAnalysis);

    this.log('Round evaluation complete');
    return {
      winningTeam: winningTeamInfo.winningTeam,
      winningPlayerId: winningTeamInfo.winningPlayerId,
      pointsEarned,
      moveRatings,
      overallRoundQuality,
      roundAnalysis
    };
  }

  // Determine which team wins the round
  private determineWinningTeam(teamMoves: Record<string, PlayerMove[]>): {
    winningTeam: 'team1' | 'team2';
    winningPlayerId: string;
  } {
    this.log('Determining winning team from moves:', teamMoves);
    const teamIds = Object.keys(teamMoves);
    
    // Handle simple 2-player case first
    if (teamIds.length === 2 && teamMoves[teamIds[0]].length === 1 && teamMoves[teamIds[1]].length === 1) {
      const firstMove = teamMoves[teamIds[0]][0];
      const secondMove = teamMoves[teamIds[1]][0];
      const firstTeam = teamIds[0] === 'team1' ? 'team1' : 'team2';
      const secondTeam = teamIds[1] === 'team2' ? 'team2' : 'team1';
      // Determine which move wins
      if (secondMove.card.suit === firstMove.card.suit) {
        // Same suit, compare values
        if (this.compareCardValues(secondMove.card.value, firstMove.card.value) > 0) {
          return {winningTeam: secondTeam, winningPlayerId: secondMove.playerId};
        } else {
          return {winningTeam: firstTeam, winningPlayerId: firstMove.playerId};
        }
      } else if (secondMove.card.suit === this.trumpSuit) {
        // Second player played trump
        return {winningTeam: secondTeam, winningPlayerId: secondMove.playerId};
      } else if (firstMove.card.suit === this.trumpSuit) {
        // First player played trump
        return {winningTeam: firstTeam, winningPlayerId: firstMove.playerId};
      } else {
        // Neither player followed suit or played trump - first player wins
        return {winningTeam: firstTeam, winningPlayerId: firstMove.playerId};
      }
    }
    
    // For multi-player teams, find the best card from each team
    const bestTeamCards: Record<string, {card: Card, playerId: string}> = {};
    
    for (const teamId of teamIds) {
      let bestCard: Card | null = null;
      let bestPlayerId = '';
      
      for (const move of teamMoves[teamId]) {
        if (!bestCard || this.compareCards(move.card, bestCard) > 0) {
          bestCard = move.card;
          bestPlayerId = move.playerId;
        }
      }
      
      if (bestCard) {
        bestTeamCards[teamId] = {card: bestCard, playerId: bestPlayerId};
      }
    }
    
    // Compare best cards from each team
    if (Object.keys(bestTeamCards).length === 2) {
      if (bestTeamCards['team1'] && bestTeamCards['team2']) {
        const comparison = this.compareCards(bestTeamCards['team1'].card, bestTeamCards['team2'].card);
        if (comparison > 0) {
          this.log('Winning team determined:', { winningTeam: 'team1', winningPlayerId: bestTeamCards['team1'].playerId });
          return { winningTeam: 'team1', winningPlayerId: bestTeamCards['team1'].playerId };
        } else {
          this.log('Winning team determined:', { winningTeam: 'team2', winningPlayerId: bestTeamCards['team2'].playerId });
          return { winningTeam: 'team2', winningPlayerId: bestTeamCards['team2'].playerId };
        }
      }
    }
    
    // Fallback if we have an unexpected configuration
    let fallbackPlayerId = '';
    if (teamMoves[teamIds[0]] && teamMoves[teamIds[0]][0]) {
      fallbackPlayerId = teamMoves[teamIds[0]][0].playerId;
    } else {
      // Find any playerId as a last resort
      const allPlayers = Object.values(teamMoves).flat();
      if (allPlayers.length > 0) {
        fallbackPlayerId = allPlayers[0].playerId;
      }
    }
    if (teamIds[0] === 'team2') {
      this.log('Winning team determined:', { winningTeam: 'team2', winningPlayerId: fallbackPlayerId } as { winningTeam: 'team1' | 'team2', winningPlayerId: string });
      return { winningTeam: 'team2', winningPlayerId: fallbackPlayerId };
    } else {
      this.log('Winning team determined:', { winningTeam: 'team1', winningPlayerId: fallbackPlayerId } as { winningTeam: 'team1' | 'team2', winningPlayerId: string });
      return { winningTeam: 'team1', winningPlayerId: fallbackPlayerId };
    }
  }

  // Rate a single move in the context of the entire round
  private rateSingleMove(move: PlayerMove, allMoves: PlayerMove[]): {
    quality: number;
    reasoning: string;
  } {
    this.log(`Rating move for player ${move.playerId}:`, move.card);
    const moveIndex = allMoves.findIndex(m => m.playerId === move.playerId);
    const isFirstPlayer = moveIndex === 0 || 
                          (moveIndex > 0 && allMoves[moveIndex - 1].teamId !== move.teamId);
    
    let quality = 5; // Default quality (average)
    let reasoning = '';

    // Calculate game phase (early, mid, late)
    const gamePhase = this.getGamePhase();
    const remainingRounds = this.totalRounds - this.currentRound;
    const cardsPlayed = this.playedCards.length;
    const totalCards = this.totalRounds * 2; // Assuming 2 players per round

    if (isFirstPlayer) {
      // Rate first player move
      const ratingInfo = this.rateFirstPlayerMove(move, allMoves, gamePhase, remainingRounds);
      quality = ratingInfo.quality;
      reasoning = ratingInfo.reasoning;
    } else {
      // Find the previous opposing team's move
      let previousOpposingMove: PlayerMove | null = null;
      for (let i = moveIndex - 1; i >= 0; i--) {
        if (allMoves[i].teamId !== move.teamId) {
          previousOpposingMove = allMoves[i];
          break;
        }
      }

      if (previousOpposingMove) {
        // Rate response move
        const ratingInfo = this.rateSecondPlayerMove(move, previousOpposingMove, allMoves, gamePhase, remainingRounds);
        quality = ratingInfo.quality;
        reasoning = ratingInfo.reasoning;
      }
    }

    // Adjust rating based on game phase
    if (gamePhase === 'late' && move.card.suit === this.trumpSuit) {
      // In late game, trump cards are more valuable
      if (move.card.value === 'A' || move.card.value === '7') {
        quality += 1;
        reasoning += ' Late game trump preservation is valuable.';
      }
    } else if (gamePhase === 'early' && move.card.suit === this.trumpSuit) {
      // In early game, using high trumps is less optimal
      if (move.card.value === 'A' || move.card.value === '7') {
        quality -= 1;
        reasoning += ' Early game high trump usage is less optimal.';
      }
    }

    // Cap quality between 1-10
    quality = Math.max(1, Math.min(10, quality));
    this.log(`Move rating complete:`, { quality, reasoning });
    return { quality, reasoning };
  }

  private getGamePhase(): 'early' | 'mid' | 'late' {
    const progress = this.currentRound / this.totalRounds;
    if (progress < 0.33) return 'early';
    if (progress < 0.66) return 'mid';
    return 'late';
  }

  // Rate a move when player is first to play
  private rateFirstPlayerMove(
    move: PlayerMove, 
    allMoves: PlayerMove[],
    gamePhase: 'early' | 'mid' | 'late',
    remainingRounds: number
  ): {
    quality: number;
    reasoning: string;
  } {
    let quality = 5;
    let reasoning = '';

    const card = move.card;
    const isHighValueCard = this.CARD_POINT_VALUES[card.value] > 3;
    const isTrump = card.suit === this.trumpSuit;

    // Leading with high value cards can be risky
    if (isHighValueCard) {
      if (isTrump) {
        // Leading with high value trump
        if (card.value === 'A' || card.value === '7') {
          if (gamePhase === 'late') {
            quality = 6;
            reasoning = 'Late game leading with high-value trump can be strategic to secure points.';
          } else if (gamePhase === 'early') {
            quality = 3;
            reasoning = 'Early game leading with high-value trump is risky and wastes valuable resources.';
          } else {
            quality = 4;
            reasoning = 'Mid game leading with high-value trump is situational.';
          }
        } else {
          quality = 6;
          reasoning = 'Leading with high-value trump generally gives control, but uses up trump resources.';
        }
      } else {
        // Leading with high value non-trump
        if (gamePhase === 'late') {
          quality = 5;
          reasoning = 'Late game leading with high-value non-trump can be necessary to secure points.';
        } else {
          quality = 4;
          reasoning = 'Leading with high-value non-trump card is risky as it might be captured.';
        }
      }
    } else {
      // Leading with low value cards
      if (isTrump) {
        if (gamePhase === 'late') {
          quality = 6;
          reasoning = 'Late game leading with low-value trump is strategic to preserve high trumps.';
        } else {
          quality = 7;
          reasoning = 'Leading with low-value trump can draw out higher trumps without risking much.';
        }
      } else {
        quality = 6;
        reasoning = 'Leading with low-value non-trump is a reasonable probing move.';
      }
    }

    // Adjust based on remaining cards in the round (if we know them)
    const remainingMoves = allMoves.slice(allMoves.indexOf(move) + 1);
    if (remainingMoves.length > 0) {
      // If we know future moves, adjust rating based on outcome
      const nextOpponentMove = remainingMoves.find(m => m.teamId !== move.teamId);
      
      if (nextOpponentMove) {
        if (nextOpponentMove.card.suit === card.suit && 
            this.compareCardValues(nextOpponentMove.card.value, card.value) > 0) {
          // Opponent captured with higher card
          quality -= 1;
          reasoning += ' Move resulted in opponent capturing with higher card.';
        } else if (nextOpponentMove.card.suit === this.trumpSuit && card.suit !== this.trumpSuit) {
          // Opponent captured with trump
          quality -= 1;
          reasoning += ' Move resulted in opponent capturing with trump.';
        } else if (isHighValueCard && 
                  (nextOpponentMove.card.suit !== card.suit && nextOpponentMove.card.suit !== this.trumpSuit)) {
          // Opponent couldn't follow suit or trump, wasting high card
          quality += 2;
          reasoning += ' Very effective as opponent couldn\'t capture the high-value card.';
        }
      }
    }

    // Cap quality between 1-10
    quality = Math.max(1, Math.min(10, quality));
    return { quality, reasoning };
  }

  // Rate a move when player is responding to an opponent's card
  private rateSecondPlayerMove(
    move: PlayerMove, 
    previousMove: PlayerMove, 
    allMoves: PlayerMove[],
    gamePhase: 'early' | 'mid' | 'late',
    remainingRounds: number
  ): {
    quality: number;
    reasoning: string;
  } {
    let quality = 5;
    let reasoning = '';

    const card = move.card;
    const prevCard = previousMove.card;
    const isTrump = card.suit === this.trumpSuit;
    const isPrevTrump = prevCard.suit === this.trumpSuit;
    const isHighValueCard = this.CARD_POINT_VALUES[card.value] > 3;
    const isPrevHighValueCard = this.CARD_POINT_VALUES[prevCard.value] > 3;
    const isFollowingSuit = card.suit === prevCard.suit;
    const moveIndex = allMoves.findIndex(m => m.playerId === move.playerId);
    const isLastPlayer = moveIndex === allMoves.length - 1;

    // Check for special A & 7 trump round scenario (only for 4 or 6 players)
    if (this.playerCount === 4 || this.playerCount === 6) {
      if (this.isSpecialTrumpRound(prevCard, card)) {
        if (card.value === 'A' && prevCard.value === '7') {
          if (gamePhase === 'late') {
            quality = 8;
            reasoning = 'Late game capturing 7 of trumps with A of trumps is excellent (special rule for 4/6 players).';
          } else {
            quality = 9;
            reasoning = 'Excellent play capturing 7 of trumps with A of trumps (special rule for 4/6 players).';
          }
        } else if (card.value === '7' && prevCard.value === 'A') {
          if (gamePhase === 'late') {
            quality = 4;
            reasoning = 'Late game playing 7 of trumps against A of trumps is less risky (special rule for 4/6 players).';
          } else {
            quality = 3;
            reasoning = 'Risky play - 7 of trumps will be captured by A of trumps (special rule for 4/6 players).';
          }
        }
      }
    } else {
      // Regular trump comparison for 2 players
      if (isTrump && isPrevTrump) {
        if (this.compareCardValues(card.value, prevCard.value) > 0) {
          quality = 7;
          reasoning = 'Good play winning with higher trump card.';
        } else {
          quality = 4;
          reasoning = 'Lost with lower trump card.';
        }
      }
    }

    // Special handling for last player in the round
    if (isLastPlayer) {
      if (isHighValueCard && !isTrump) {
        // If last player plays a high-value non-trump card
        if (this.compareCards(card, prevCard) > 0) {
          // And wins the round
          quality = 8;
          reasoning = 'Excellent play - as last player, using high-value non-trump to win while preserving trump cards.';
        } else {
          // But loses the round
          quality = 3;
          reasoning = 'Poor play - as last player, wasted high-value card when could have used trump to win.';
        }
      } else if (!isTrump && this.compareCards(card, prevCard) > 0) {
        // Last player wins with a low-value non-trump card
        quality = 7;
        reasoning = 'Good play - as last player, winning with low-value card while preserving trump cards.';
      }
    } else {
      // Not the last player - more nuanced evaluation
      if (isFollowingSuit) {
        if (isHighValueCard) {
          if (isPrevHighValueCard) {
            // Responding to high card with high card
            if (this.compareCardValues(card.value, prevCard.value) > 0) {
              quality = 7;
              reasoning = 'Good play - winning with higher card against opponent\'s high card.';
            } else {
              quality = 5;
              reasoning = 'Reasonable play - using high card to try to win, but lost to higher card.';
            }
          } else {
            // Responding to low card with high card
            if (this.compareCardValues(card.value, prevCard.value) > 0) {
              quality = 6;
              reasoning = 'Good play - winning with high card against low card, but could have used lower card.';
            } else {
              quality = 4;
              reasoning = 'Poor play - wasted high card when could have used lower card to win.';
            }
          }
        } else {
          // Using low card to respond
          if (this.compareCardValues(card.value, prevCard.value) > 0) {
            quality = 7;
            reasoning = 'Excellent play - winning with lowest possible card.';
          } else {
            quality = 6;
            reasoning = 'Good play - using low card to respond, preserving higher cards.';
          }
        }
      } else if (isTrump) {
        // Playing trump
        if (isPrevHighValueCard) {
          quality = 7;
          reasoning = 'Good play - using trump to capture opponent\'s high card.';
        } else {
          quality = 5;
          reasoning = 'Reasonable play - using trump to win, but could have saved it for higher value cards.';
        }
      } else {
        // Not following suit and not playing trump
        if (isHighValueCard) {
          quality = 3;
          reasoning = 'Poor play - wasting high card when can\'t follow suit or trump.';
        } else {
          quality = 6;
          reasoning = 'Good play - dumping low card when can\'t follow suit or trump.';
        }
      }
    }

    // Cap quality between 1-10
    quality = Math.max(1, Math.min(10, quality));
    return { quality, reasoning };
  }

  // Generate detailed reasoning for a move
  private generateMoveReasoning(move: PlayerMove, allMoves: PlayerMove[], winningPlayerId: string): string {
    const moveIndex = allMoves.findIndex(m => m.playerId === move.playerId);
    const isFirstPlayer = moveIndex === 0 || 
                         (moveIndex > 0 && allMoves[moveIndex - 1].teamId !== move.teamId);
    
    let reasoning = '';
    
    // Add context about the move
    reasoning += `Player ${move.playerId} played ${move.card.value} of ${move.card.suit}. `;
    
    // Add whether this move won the round
    if (move.playerId === winningPlayerId) {
      reasoning += 'This move won the round. ';
    }
    
    // Add specific move analysis
    if (isFirstPlayer) {
      const { reasoning: moveReasoning } = this.rateFirstPlayerMove(move, allMoves, this.getGamePhase(), this.totalRounds - this.currentRound);
      reasoning += moveReasoning;
    } else {
      // Find preceding opponent move
      let precedingMove: PlayerMove | null = null;
      for (let i = moveIndex - 1; i >= 0; i--) {
        if (allMoves[i].teamId !== move.teamId) {
          precedingMove = allMoves[i];
          break;
        }
      }
      
      if (precedingMove) {
        reasoning += `Responding to ${precedingMove.card.value} of ${precedingMove.card.suit}. `;
        const { reasoning: moveReasoning } = this.rateSecondPlayerMove(move, precedingMove, allMoves, this.getGamePhase(), this.totalRounds - this.currentRound);
        reasoning += moveReasoning;
      }
    }
    
    return reasoning;
  }

  // Calculate the total point value of all cards in the round
  private calculateRoundPoints(moves: PlayerMove[]): number {
    this.log('Calculating round points for moves:', moves);
    const points = moves.reduce((sum, move) => sum + this.CARD_POINT_VALUES[move.card.value], 0);
    this.log('Round points calculated:', points);
    return points;
  }

  // Calculate the overall quality of the round based on all move ratings
  private calculateOverallRoundQuality(moveRatings: { playerId: string; moveQuality: number }[]): number {
    this.log('Calculating overall round quality from ratings:', moveRatings);
    if (moveRatings.length === 0) {
      this.log('No moves to rate, returning default quality');
      return 5;
    }
    
    const sum = moveRatings.reduce((total, rating) => total + rating.moveQuality, 0);
    const average = sum / moveRatings.length;
    this.log('Overall round quality calculated:', average);
    return average;
  }

  // Update player history with new move data
  private updatePlayerHistory(moveRatings: { playerId: string; moveQuality: number }[]): void {
    this.log('Updating player history with ratings:', moveRatings);
    moveRatings.forEach(rating => {
      const playerId = rating.playerId;
      
      if (!this.playerHistory[playerId]) {
        this.playerHistory[playerId] = {
          totalMoves: 0,
          goodMoves: 0,
          badMoves: 0,
          avgRating: 0,
          trumpUsage: 0
        };
      }
      
      const history = this.playerHistory[playerId];
      history.totalMoves++;
      
      if (rating.moveQuality >= 7) {
        history.goodMoves++;
      } else if (rating.moveQuality <= 3) {
        history.badMoves++;
      }
      
      // Update average rating
      history.avgRating = 
        ((history.avgRating * (history.totalMoves - 1)) + rating.moveQuality) / history.totalMoves;
    });
    this.log('Player history updated');
  }

  // Generate a detailed analysis of the round
  private generateRoundAnalysis(
    moves: PlayerMove[], 
    winningTeamInfo: {winningTeam: 'team1' | 'team2', winningPlayerId: string}, 
    moveRatings: {playerId: string, moveQuality: number, reasoning: string}[],
    pointsEarned: number
  ): string {
    this.log('Generating round analysis');
    let analysis = '';
    
    // Describe the round sequence
    analysis += 'Round Sequence: ';
    moves.forEach((move, index) => {
      analysis += `${move.playerId}(${move.card.value} of ${move.card.suit})`;
      if (index < moves.length - 1) analysis += ' → ';
    });
    analysis += '\n\n';
    
    // Highlight best and worst moves
    const sortedRatings = [...moveRatings].sort((a, b) => b.moveQuality - a.moveQuality);
    if (sortedRatings.length > 0) {
      const best = sortedRatings[0];
      const worst = sortedRatings[sortedRatings.length - 1];
      
      analysis += `Best Move: Player ${best.playerId} (rated ${best.moveQuality}/10) - ${best.reasoning}\n`;
      analysis += `Worst Move: Player ${worst.playerId} (rated ${worst.moveQuality}/10) - ${worst.reasoning}\n\n`;
    }
    
    // Outcome summary
    analysis += `Outcome: Team ${winningTeamInfo.winningTeam} won the round with player ${winningTeamInfo.winningPlayerId}'s card.\n`;
    analysis += `Points Earned: ${pointsEarned}\n`;
    
    // Overall round quality assessment
    const averageQuality = this.calculateOverallRoundQuality(moveRatings);
    analysis += `Round Quality: ${averageQuality.toFixed(1)}/10 - `;
    
    if (averageQuality >= 8) {
      analysis += 'Excellent round with high-quality strategic plays.';
    } else if (averageQuality >= 6) {
      analysis += 'Good round with mostly solid decision making.';
    } else if (averageQuality >= 4) {
      analysis += 'Average round with mixed quality plays.';
    } else {
      analysis += 'Below average round with several suboptimal decisions.';
    }
    
    this.log('Round analysis generated:', analysis);
    return analysis;
  }

  // Get player performance statistics
  public getPlayerStats(playerId: string): {
    totalMoves: number;
    goodMovePercentage: number;
    badMovePercentage: number;
    averageRating: number;
    trumpUsageRate: number;
  } | null {
    const history = this.playerHistory[playerId];
    if (!history) return null;
    
    return {
      totalMoves: history.totalMoves,
      goodMovePercentage: (history.goodMoves / history.totalMoves) * 100,
      badMovePercentage: (history.badMoves / history.totalMoves) * 100,
      averageRating: history.avgRating,
      trumpUsageRate: history.trumpUsage / history.totalMoves
    };
  }

  // Utility methods
  private isSpecialTrumpRound(card1: Card, card2: Card): boolean {
    // Special rules only apply for 4 or 6 players
    if (this.playerCount !== 4 && this.playerCount !== 6) {
      return false;
    }

    return card1.suit === this.trumpSuit && 
           card2.suit === this.trumpSuit &&
           ((card1.value === 'A' && card2.value === '7') || 
            (card1.value === '7' && card2.value === 'A'));
  }

  private compareCards(card1: Card, card2: Card): number {
    // If either card is trump, trump wins
    if (card1.suit === this.trumpSuit && card2.suit !== this.trumpSuit) {
      return 1; // First card is trump, second isn't - trump wins
    } else if (card2.suit === this.trumpSuit && card1.suit !== this.trumpSuit) {
      return -1; // Second card is trump, first isn't - trump wins
    } else if (card1.suit === this.trumpSuit && card2.suit === this.trumpSuit) {
      // Both are trump, compare values
      return this.compareCardValues(card1.value, card2.value);
    } else if (card1.suit === card2.suit) {
      // Same non-trump suit, compare values
      return this.compareCardValues(card1.value, card2.value);
    } else {
      // Different non-trump suits, neither wins - first card wins by default
      return 1;
    }
  }

  private compareCardValues(value1: CardValue, value2: CardValue): number {
    const valueOrder: Record<CardValue, number> = {
      'A': 8,  // Highest
      '7': 7,  // Second highest
      'K': 6,  // Third highest
      'J': 5,  // Fourth highest
      'Q': 4,  // Fifth highest
      '6': 3,  // Sixth highest
      '5': 2,  // Seventh highest
      '4': 1,  // Eighth highest
      '3': 0   // Lowest
    };
    
    return valueOrder[value1] - valueOrder[value2];
  }

  // Helper method to get card from ID
  private getCardFromId(cardId: CardId): Card {
    return STATIC_CARDS[cardId];
  }

  private checkFirstRoundSpecialWin(moves: PlayerMove[]): {
    isSpecialWin: boolean;
    winningTeam: 'team1' | 'team2';
    winningPlayerId: string;
    bonusPoints: number;
    reasoning: string;
  } {
    this.log('Checking for first round special win');
    
    // Special rules only apply for 4 or 6 players
    if (this.playerCount !== 4 && this.playerCount !== 6) {
      this.log('Special rules not applicable - not 4 or 6 players');
      return {
        isSpecialWin: false,
        winningTeam: 'team1',
        winningPlayerId: '',
        bonusPoints: 0,
        reasoning: ''
      };
    }

    // Group moves by teams
    const teamMoves: Record<string, PlayerMove[]> = {};
    moves.forEach(move => {
      if (!teamMoves[move.teamId]) {
        teamMoves[move.teamId] = [];
      }
      teamMoves[move.teamId].push(move);
    });

    const teamIds = Object.keys(teamMoves);
    
    // Check for winning with '3' of trump suit in first round
    for (const teamId of teamIds) {
      const winningMove = teamMoves[teamId].find(move => 
        move.card.suit === this.trumpSuit && 
        move.card.value === '3' &&
        this.determineWinningTeam(teamMoves).winningTeam === teamId
      );

      if (winningMove) {
        return {
          isSpecialWin: true,
          winningTeam: 'team1',
          winningPlayerId: winningMove.playerId,
          bonusPoints: 20, // Bonus points for winning with 3 of trump
          reasoning: `Team won first round with 3 of trump suit (special rule for 4/6 players)`
        };
      }
    }

    // Check for winning with card superiority when no trump cards played
    const nonTrumpMoves = moves.filter(move => move.card.suit !== this.trumpSuit);
    if (nonTrumpMoves.length === moves.length) {
      // Find the winning move based on card superiority
      const winningTeamInfo = this.determineWinningTeam(teamMoves);
      if (winningTeamInfo.winningTeam) {
        const winningMove = teamMoves[winningTeamInfo.winningTeam].find(move => 
          move.playerId === winningTeamInfo.winningPlayerId
        );

        if (winningMove) {
          return {
            isSpecialWin: true,
            winningTeam: 'team1',
            winningPlayerId: winningTeamInfo.winningPlayerId,
            bonusPoints: 10, // Bonus points for winning with card superiority
            reasoning: `Team won first round with card superiority (special rule for 4/6 players)`
          };
        }
      }
    }

    this.log('No special first round win detected');
    return {
      isSpecialWin: false,
      winningTeam: 'team1',
      winningPlayerId: '',
      bonusPoints: 0,
      reasoning: ''
    };
  }
}