
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from "sonner";
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { Button } from '../components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Clock, Trophy } from 'lucide-react';

// Define types
type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';
type AttendeeType = {
  id: number;
  position: Position;
  color: string;
  isSeated: boolean;
  targetSeat?: Position;
  nextMove?: number; // Timestamp for next move
};
type CellType = 'empty' | 'chair' | 'wall' | 'hallway' | 'aisle' | 'carpet' | 'podium' | 'row-aisle' | 'sign';
type GridCell = {
  type: CellType;
  occupiedBy?: number; // ID of attendee occupying the cell
  isChair?: boolean;
  chairId?: number;
  text?: string; // For the sign text
  score?: number; // Score value for this cell if it's a chair
};

const GRID_ROWS = 15; // Adjusted for compact layout
const GRID_COLS = 30;
const TOTAL_ATTENDEES = 48;
const PLAYER_ID = 0;
const CHAIR_ROWS = 3;
const CHAIRS_PER_ROW = 8;
const CELL_SIZE = 32; // pixels
const MOVE_INTERVAL = 1000; // 1 second in milliseconds

const ConferenceRoom: React.FC = () => {
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [attendees, setAttendees] = useState<AttendeeType[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerSeated, setPlayerSeated] = useState(false);
  const [movesCount, setMovesCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastTick, setLastTick] = useState(0);
  const [playerScore, setPlayerScore] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const timerRef = useRef<number>();
  
  // Calculate score for a chair based on distance from stage
  const calculateChairScore = (row: number): number => {
    // Closer to stage = higher score (max 500, min 100)
    const maxScore = 500;
    const minScore = 100;
    const normalizedRow = (GRID_ROWS - row) / GRID_ROWS; // Higher for rows closer to stage
    return Math.round(minScore + normalizedRow * (maxScore - minScore));
  };

  // Initialize the grid and attendees
  const initializeGame = useCallback(() => {
    // Create an empty grid
    const newGrid: GridCell[][] = Array(GRID_ROWS).fill(null).map(() =>
      Array(GRID_COLS).fill(null).map(() => ({ type: 'empty' }))
    );

    // Create walls
    for (let col = 0; col < GRID_COLS; col++) {
      newGrid[0][col].type = 'wall';
      newGrid[GRID_ROWS - 1][col].type = 'wall';
    }

    for (let row = 0; row < GRID_ROWS; row++) {
      newGrid[row][0].type = 'wall';
      newGrid[row][GRID_COLS - 1].type = 'wall';
    }

    // Create hallway
    for (let row = 1; row < 4; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        newGrid[row][col].type = 'hallway';
      }
    }

    // Create carpet area
    for (let row = 4; row < GRID_ROWS - 1; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        newGrid[row][col].type = 'carpet';
      }
    }

    // Create center aisle
    const aisleCol = Math.floor(GRID_COLS / 2);
    for (let row = 4; row < GRID_ROWS - 1; row++) {
      for (let col = aisleCol - 1; col <= aisleCol + 1; col++) {
        newGrid[row][col].type = 'aisle';
      }
    }

    // Create podium
    for (let row = GRID_ROWS - 3; row < GRID_ROWS - 1; row++) {
      for (let col = aisleCol - 2; col <= aisleCol + 2; col++) {
        newGrid[row][col].type = 'podium';
      }
    }

    // Add sign on the podium
    newGrid[GRID_ROWS - 2][aisleCol].type = 'sign';
    newGrid[GRID_ROWS - 2][aisleCol].text = 'Velkommen til Forse fagdag';

    // Chair configuration parameters
    const firstChairRow = 5; // First row of chairs starts at this y-position
    const chairRowSpacing = 2; // One row of space between chair rows
    
    // Create chair rows and row aisles
    const chairPositions: Position[] = [];
    
    for (let rowIdx = 0; rowIdx < CHAIR_ROWS; rowIdx++) {
      const chairRowY = firstChairRow + (rowIdx * chairRowSpacing);
      
      // Create row aisle after each chair row (except the last one)
      if (rowIdx < CHAIR_ROWS - 1) {
        for (let col = 1; col < GRID_COLS - 1; col++) {
          if (col < aisleCol - 1 || col > aisleCol + 1) { // Skip center aisle cells
            newGrid[chairRowY + 1][col].type = 'row-aisle';
          }
        }
      }
      
      // Left side chairs (24 chairs, 8 per row)
      for (let i = 0; i < CHAIRS_PER_ROW; i++) {
        const chairCol = aisleCol - 1 - CHAIRS_PER_ROW + i; // Position chairs directly next to center aisle
        newGrid[chairRowY][chairCol].type = 'chair';
        newGrid[chairRowY][chairCol].isChair = true;
        newGrid[chairRowY][chairCol].chairId = chairPositions.length;
        // Calculate score based on proximity to stage
        newGrid[chairRowY][chairCol].score = calculateChairScore(chairRowY);
        chairPositions.push({ x: chairCol, y: chairRowY });
      }
      
      // Right side chairs (24 chairs, 8 per row)
      for (let i = 0; i < CHAIRS_PER_ROW; i++) {
        const chairCol = aisleCol + 2 + i; // Start right after center aisle
        newGrid[chairRowY][chairCol].type = 'chair';
        newGrid[chairRowY][chairCol].isChair = true;
        newGrid[chairRowY][chairCol].chairId = chairPositions.length;
        // Calculate score based on proximity to stage
        newGrid[chairRowY][chairCol].score = calculateChairScore(chairRowY);
        chairPositions.push({ x: chairCol, y: chairRowY });
      }
    }

    // Initialize attendees at the top of the screen in the hallway
    const hallwayStartX = 2;
    const hallwayStartY = 1; // Start at the top of the hallway
    const newAttendees: AttendeeType[] = [];
    
    // Position calculation for two-abreast line
    const getAttendeePosition = (index: number): Position => {
      const row = Math.floor(index / 2);
      const col = index % 2 === 0 ? 0 : 1;
      return { 
        x: hallwayStartX + col, 
        y: hallwayStartY + row
      };
    };

    // Shuffle chair positions for random seat selection
    const shuffledChairPositions = [...chairPositions];
    for (let i = shuffledChairPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledChairPositions[i], shuffledChairPositions[j]] = [shuffledChairPositions[j], shuffledChairPositions[i]];
    }

    // Create all non-player attendees
    for (let i = 0; i < TOTAL_ATTENDEES; i++) {
      if (i !== PLAYER_ID) {
        const position = getAttendeePosition(i);
        const attendee: AttendeeType = {
          id: i,
          position,
          color: 'bg-yellow-400', // All other attendees are yellow
          isSeated: false,
          // Assign random seat from shuffled list
          targetSeat: { ...shuffledChairPositions[i % shuffledChairPositions.length] },
          nextMove: Date.now() + MOVE_INTERVAL
        };
        newAttendees.push(attendee);
      }
    }
    
    // Position player in the middle of the group
    const playerIndex = Math.floor(TOTAL_ATTENDEES / 2);
    const playerPosition = getAttendeePosition(playerIndex);
    
    // Create player
    newAttendees.splice(PLAYER_ID, 0, {
      id: PLAYER_ID,
      position: playerPosition,
      color: 'bg-green-500', // Player is green
      isSeated: false,
      nextMove: Date.now() + MOVE_INTERVAL
    });
    
    // Update occupation
    for (const attendee of newAttendees) {
      const { x, y } = attendee.position;
      if (y >= 0 && y < GRID_ROWS && x >= 0 && x < GRID_COLS) {
        newGrid[y][x].occupiedBy = attendee.id;
      }
    }
    
    setGrid(newGrid);
    setAttendees(newAttendees);
    setGameStarted(true);
    setGameOver(false);
    setPlayerSeated(false);
    setMovesCount(0);
    setElapsedTime(0);
    setLastTick(Date.now());
    setPlayerScore(null);
  }, []);

  // Main game loop
  useEffect(() => {
    if (gameStarted && !gameOver) {
      const updateClock = () => {
        const now = Date.now();
        const delta = now - lastTick;
        
        if (delta >= 1000) { // Update every second
          setElapsedTime(prev => prev + 1);
          setLastTick(now);
        }
        
        // Check for NPC movement
        setAttendees(prevAttendees => {
          let updated = false;
          const newAttendees = prevAttendees.map(attendee => {
            if (attendee.id !== PLAYER_ID && !attendee.isSeated && attendee.nextMove && attendee.nextMove <= now) {
              updated = true;
              const updatedAttendee = { ...attendee, nextMove: now + MOVE_INTERVAL };
              moveNPC(updatedAttendee);
              return updatedAttendee;
            }
            return attendee;
          });
          
          if (updated) {
            // Update grid occupation
            updateGridOccupation(newAttendees);
          }
          
          return updated ? newAttendees : prevAttendees;
        });
        
        // Check if all attendees are seated
        const allSeated = attendees.every(a => a.isSeated);
        if (allSeated) {
          setGameOver(true);
          toast("Everyone is seated! The presentation can begin!");
          return;
        }
        
        timerRef.current = requestAnimationFrame(updateClock);
      };
      
      timerRef.current = requestAnimationFrame(updateClock);
      
      return () => {
        if (timerRef.current) {
          cancelAnimationFrame(timerRef.current);
        }
      };
    }
  }, [gameStarted, gameOver, lastTick, attendees]);

  // Update grid occupation based on attendee positions
  const updateGridOccupation = (newAttendees: AttendeeType[]) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => 
        row.map(cell => ({ ...cell, occupiedBy: undefined }))
      );
      
      // Mark cells as occupied
      for (const attendee of newAttendees) {
        const { x, y } = attendee.position;
        if (y >= 0 && y < GRID_ROWS && x >= 0 && x < GRID_COLS) {
          newGrid[y][x].occupiedBy = attendee.id;
        }
      }
      
      return newGrid;
    });
  };

  // Move an NPC attendee
  const moveNPC = (attendee: AttendeeType) => {
    if (!attendee || attendee.isSeated) return;
    
    if (attendee.targetSeat) {
      // Determine if the attendee is at their target
      const atTarget = 
        attendee.position.x === attendee.targetSeat.x && 
        attendee.position.y === attendee.targetSeat.y;
      
      if (atTarget) {
        attendee.isSeated = true;
        return;
      }
      
      // Try to move towards target seat
      const dx = Math.sign(attendee.targetSeat.x - attendee.position.x);
      const dy = Math.sign(attendee.targetSeat.y - attendee.position.y);
      
      // Randomly decide whether to move horizontally or vertically first
      // to add some randomness to movement patterns
      const moveHorizontalFirst = Math.random() > 0.5;
      
      if (moveHorizontalFirst) {
        // Try horizontal move first
        if (dx !== 0) {
          const newX = attendee.position.x + dx;
          const canMove = isValidMove(attendee.id, { x: newX, y: attendee.position.y });
          
          if (canMove) {
            attendee.position.x = newX;
            return;
          }
        }
        
        // Then try vertical move
        if (dy !== 0) {
          const newY = attendee.position.y + dy;
          const canMove = isValidMove(attendee.id, { x: attendee.position.x, y: newY });
          
          if (canMove) {
            attendee.position.y = newY;
            return;
          }
        }
      } else {
        // Try vertical move first
        if (dy !== 0) {
          const newY = attendee.position.y + dy;
          const canMove = isValidMove(attendee.id, { x: attendee.position.x, y: newY });
          
          if (canMove) {
            attendee.position.y = newY;
            return;
          }
        }
        
        // Then try horizontal move
        if (dx !== 0) {
          const newX = attendee.position.x + dx;
          const canMove = isValidMove(attendee.id, { x: newX, y: attendee.position.y });
          
          if (canMove) {
            attendee.position.x = newX;
            return;
          }
        }
      }
      
      // If blocked, try random movement
      const directions: Direction[] = ['up', 'down', 'left', 'right'];
      directions.sort(() => Math.random() - 0.5);
      
      for (const dir of directions) {
        const newPos = getNewPosition(attendee.position, dir);
        if (isValidMove(attendee.id, newPos)) {
          attendee.position = newPos;
          break;
        }
      }
    }
  };

  // Utility function to check if a move is valid
  const isValidMove = (attendeeId: number, position: Position): boolean => {
    const { x, y } = position;
    
    // Check boundaries
    if (y < 0 || y >= GRID_ROWS || x < 0 || x >= GRID_COLS) {
      return false;
    }
    
    // Check cell type
    const cell = grid[y][x];
    if (cell.type === 'wall') {
      return false;
    }
    
    // Check occupation
    if (cell.occupiedBy !== undefined && cell.occupiedBy !== attendeeId) {
      return false;
    }
    
    // Special case for the player - check if trying to sit
    if (attendeeId === PLAYER_ID && cell.type === 'chair') {
      return true; // Allow player to sit on chairs
    }
    
    // For NPCs check if this is their target chair
    if (attendeeId !== PLAYER_ID && cell.type === 'chair') {
      const attendee = attendees.find(a => a.id === attendeeId);
      if (!attendee || !attendee.targetSeat) return false;
      
      return attendee.targetSeat.x === x && attendee.targetSeat.y === y;
    }
    
    return true;
  };

  // Utility function to get new position based on direction
  const getNewPosition = (position: Position, direction: Direction): Position => {
    const { x, y } = position;
    switch (direction) {
      case 'up': return { x, y: y - 1 };
      case 'down': return { x, y: y + 1 };
      case 'left': return { x: x - 1, y };
      case 'right': return { x: x + 1, y };
    }
  };

  // Handle player movement with keyboard
  const movePlayer = useCallback((direction: Direction) => {
    if (gameOver || playerSeated) return;
    
    setAttendees(prevAttendees => {
      const newAttendees = [...prevAttendees];
      const player = newAttendees.find(a => a.id === PLAYER_ID);
      
      if (!player) return prevAttendees;
      
      const newPosition = getNewPosition(player.position, direction);
      
      if (isValidMove(PLAYER_ID, newPosition)) {
        const oldPosition = { ...player.position };
        player.position = newPosition;
        
        // Update grid occupation
        setGrid(prevGrid => {
          const newGrid = [...prevGrid];
          
          // Clear old position
          if (newGrid[oldPosition.y][oldPosition.x].occupiedBy === PLAYER_ID) {
            newGrid[oldPosition.y][oldPosition.x] = { 
              ...newGrid[oldPosition.y][oldPosition.x], 
              occupiedBy: undefined 
            };
          }
          
          // Set new position
          newGrid[newPosition.y][newPosition.x] = { 
            ...newGrid[newPosition.y][newPosition.x], 
            occupiedBy: PLAYER_ID 
          };
          
          // Check if player is sitting on a chair
          if (newGrid[newPosition.y][newPosition.x].type === 'chair') {
            player.isSeated = true;
            setPlayerSeated(true);
            
            // Calculate and show score
            const chairScore = newGrid[newPosition.y][newPosition.x].score || 0;
            setPlayerScore(chairScore);
            toast.success(`You found a seat! Your score: ${chairScore} points!`);
          }
          
          return newGrid;
        });
        
        setMovesCount(prev => prev + 1);
        return newAttendees;
      }
      
      return prevAttendees;
    });
  }, [gameOver, playerSeated, grid]);

  // Hook up keyboard controls
  useKeyboardControls({
    onArrowUp: () => movePlayer('up'),
    onArrowDown: () => movePlayer('down'),
    onArrowLeft: () => movePlayer('left'),
    onArrowRight: () => movePlayer('right'),
    enabled: gameStarted && !gameOver && !playerSeated
  });

  // Render game grid
  const renderGrid = () => {
    return (
      <div 
        ref={gridRef}
        className="grid overflow-auto border-2 border-gray-800"
        style={{ 
          gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
          gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
          maxHeight: '70vh',
          maxWidth: '90vw'
        }}
      >
        {grid.map((row, rowIdx) => 
          row.map((cell, colIdx) => (
            <div 
              key={`${rowIdx}-${colIdx}`} 
              className={`grid-cell ${cell.type}`}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
            >
              {cell.type === 'sign' && (
                <div className="sign">
                  <span className="text-white text-xs font-bold px-1">
                    {cell.text}
                  </span>
                </div>
              )}
              {cell.occupiedBy !== undefined && (
                <div 
                  className={`
                    ${cell.occupiedBy === PLAYER_ID ? 'avatar-player' : 'avatar-npc'} 
                    ${attendees.find(a => a.id === cell.occupiedBy)?.color || 'bg-gray-500'}
                    ${attendees.find(a => a.id === cell.occupiedBy)?.isSeated ? 'animate-bounce-slow' : ''}
                    flex items-center justify-center text-xs font-bold
                  `}
                  style={{ width: CELL_SIZE * 0.7, height: CELL_SIZE * 0.7 }}
                >
                  {cell.occupiedBy}
                </div>
              )}
              {cell.type === 'chair' && cell.occupiedBy === undefined && (
                <div className="chair"></div>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  // On component mount
  useEffect(() => {
    initializeGame();
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [initializeGame]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-4">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold mb-2">Conference Room Seat Chase</h1>
        <p className="text-lg text-gray-700 mb-4">
          Find a seat before the presentation starts!
        </p>
        
        <div className="flex justify-center space-x-4 mb-4">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
            <span>You (#0)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-yellow-400 mr-2"></div>
            <span>Other Attendees</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-md bg-amber-800 mr-2"></div>
            <span>Chair</span>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-md p-4 mb-4">
        <div className="text-center mb-4 flex justify-between items-center px-4">
          <div>
            <p className="text-lg">
              Moves: <span className="font-bold">{movesCount}</span>
            </p>
          </div>
          
          <div className="flex items-center">
            <Clock className="mr-2 h-5 w-5 text-gray-500" />
            <p className="text-lg font-mono">{formatTime(elapsedTime)}</p>
          </div>
          
          <div>
            <p className="text-lg">
              Seated: <span className="font-bold">{attendees.filter(a => a.isSeated).length}</span> of {TOTAL_ATTENDEES}
            </p>
          </div>
        </div>
        
        {gameOver ? (
          <p className="text-xl font-semibold text-green-600 text-center mb-4">
            Everyone is seated! Presentation starting.
          </p>
        ) : playerSeated ? (
          <div className="flex flex-col items-center mb-4">
            <p className="text-xl font-semibold text-blue-600 text-center">
              You found a seat! Waiting for others...
            </p>
            {playerScore !== null && (
              <div className="flex items-center mt-2 bg-yellow-100 p-2 rounded-md">
                <Trophy className="h-5 w-5 text-yellow-600 mr-2" />
                <span className="font-bold text-yellow-900">Score: {playerScore} points</span>
              </div>
            )}
          </div>
        ) : null}
        
        {renderGrid()}
        
        <div className="flex flex-col items-center mt-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div></div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => movePlayer('up')}
              disabled={gameOver || playerSeated}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <div></div>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => movePlayer('left')}
              disabled={gameOver || playerSeated}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => movePlayer('down')}
              disabled={gameOver || playerSeated}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => movePlayer('right')}
              disabled={gameOver || playerSeated}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            onClick={initializeGame} 
            className="mt-2"
          >
            {gameStarted ? "Restart Game" : "Start Game"}
          </Button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-4 shadow-md w-full max-w-md">
        <h2 className="text-xl font-bold mb-2">How to Play:</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use arrow keys or buttons to move your character (green circle with #0)</li>
          <li>Everyone moves one step per second - you can move anytime</li>
          <li>Navigate through the crowd to find an empty chair</li>
          <li>Once seated, you can't stand up again</li>
          <li>All attendees have numbers to identify them</li>
          <li>The game ends when all 48 attendees are seated</li>
          <li>Seats closer to the stage are worth more points!</li>
        </ul>
      </div>
    </div>
  );
};

export default ConferenceRoom;
