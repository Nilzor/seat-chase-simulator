import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from "sonner";
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { Button } from '../components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

// Define types
type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';
type AttendeeType = {
  id: number;
  position: Position;
  color: string;
  isSeated: boolean;
  targetSeat?: Position;
};
type CellType = 'empty' | 'chair' | 'wall' | 'hallway' | 'aisle' | 'carpet' | 'podium';
type GridCell = {
  type: CellType;
  occupiedBy?: number; // ID of attendee occupying the cell
  isChair?: boolean;
  chairId?: number;
};

const GRID_ROWS = 15;
const GRID_COLS = 30;
const TOTAL_ATTENDEES = 48;
const PLAYER_ID = 0;
const CHAIR_ROWS = 3;
const CHAIRS_PER_ROW = 8;
const CELL_SIZE = 32; // pixels

const generateRandomColor = () => {
  const colors = [
    'bg-red-400', 'bg-green-400', 'bg-yellow-400', 'bg-purple-400', 
    'bg-pink-400', 'bg-indigo-400', 'bg-teal-400', 'bg-orange-400'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const ConferenceRoom: React.FC = () => {
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [attendees, setAttendees] = useState<AttendeeType[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerSeated, setPlayerSeated] = useState(false);
  const [movesCount, setMovesCount] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  
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
    for (let row = 1; row < 5; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        newGrid[row][col].type = 'hallway';
      }
    }

    // Create carpet area
    for (let row = 5; row < GRID_ROWS - 1; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        newGrid[row][col].type = 'carpet';
      }
    }

    // Create center aisle
    const aisleCol = Math.floor(GRID_COLS / 2);
    for (let row = 5; row < GRID_ROWS - 1; row++) {
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

    // Create seats on both sides
    const chairPositions: Position[] = [];
    const leftSide = aisleCol - 2;
    const rightSide = aisleCol + 2;
    
    // Left side chairs
    for (let row = 6; row < 6 + CHAIR_ROWS; row++) {
      for (let col = 2; col < leftSide; col += 3) {
        for (let i = 0; i < CHAIRS_PER_ROW / 2; i++) {
          const chairCol = col + i;
          if (chairCol < leftSide) {
            newGrid[row][chairCol].type = 'chair';
            newGrid[row][chairCol].isChair = true;
            newGrid[row][chairCol].chairId = chairPositions.length;
            chairPositions.push({ x: chairCol, y: row });
          }
        }
      }
    }
    
    // Right side chairs
    for (let row = 6; row < 6 + CHAIR_ROWS; row++) {
      for (let col = rightSide; col < GRID_COLS - 2; col += 3) {
        for (let i = 0; i < CHAIRS_PER_ROW / 2; i++) {
          const chairCol = col + i;
          if (chairCol < GRID_COLS - 1) {
            newGrid[row][chairCol].type = 'chair';
            newGrid[row][chairCol].isChair = true;
            newGrid[row][chairCol].chairId = chairPositions.length;
            chairPositions.push({ x: chairCol, y: row });
          }
        }
      }
    }

    // Initialize attendees
    const startX = 5;
    const startY = 2;
    const newAttendees: AttendeeType[] = [];
    
    // Player
    newAttendees.push({
      id: PLAYER_ID,
      position: { x: startX, y: startY },
      color: 'bg-blue-500',
      isSeated: false
    });
    
    // Other attendees
    for (let i = 1; i < TOTAL_ATTENDEES; i++) {
      const randX = Math.floor(Math.random() * (GRID_COLS - 4)) + 2;
      const randY = Math.floor(Math.random() * 2) + 2;
      
      const attendee: AttendeeType = {
        id: i,
        position: { x: randX, y: randY },
        color: generateRandomColor(),
        isSeated: false,
        targetSeat: { ...chairPositions[i % chairPositions.length] }
      };
      
      newAttendees.push(attendee);
    }
    
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
  }, []);

  useEffect(() => {
    if (gameStarted) {
      const moveNPCs = () => {
        setAttendees(prevAttendees => {
          const newAttendees = [...prevAttendees];
          
          for (let i = 1; i < newAttendees.length; i++) {
            const attendee = newAttendees[i];
            
            if (attendee.isSeated) continue;
            
            if (attendee.targetSeat) {
              // Determine if the attendee is at their target
              const atTarget = 
                attendee.position.x === attendee.targetSeat.x && 
                attendee.position.y === attendee.targetSeat.y;
              
              if (atTarget) {
                attendee.isSeated = true;
                continue;
              }
              
              // Try to move towards target seat
              const dx = Math.sign(attendee.targetSeat.x - attendee.position.x);
              const dy = Math.sign(attendee.targetSeat.y - attendee.position.y);
              
              // First try to move horizontally
              if (dx !== 0) {
                const newX = attendee.position.x + dx;
                const canMove = isValidMove(attendee.id, { x: newX, y: attendee.position.y });
                
                if (canMove) {
                  attendee.position.x = newX;
                  continue;
                }
              }
              
              // Then try to move vertically
              if (dy !== 0) {
                const newY = attendee.position.y + dy;
                const canMove = isValidMove(attendee.id, { x: attendee.position.x, y: newY });
                
                if (canMove) {
                  attendee.position.y = newY;
                  continue;
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
          }
          
          // Update grid occupation
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
          
          // Check if all attendees are seated
          const allSeated = newAttendees.every(a => a.isSeated);
          if (allSeated) {
            setGameOver(true);
            toast("Everyone is seated! The presentation can begin!");
          }
          
          return newAttendees;
        });
        
        if (!gameOver) {
          animationFrameRef.current = requestAnimationFrame(moveNPCs);
        }
      };
      
      // Schedule NPC movement
      const timeoutId = setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(moveNPCs);
      }, 1000);
      
      return () => {
        clearTimeout(timeoutId);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [gameStarted, gameOver]);

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
            toast("You found a seat! Now wait for others to be seated.");
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
              {cell.occupiedBy !== undefined && (
                <div 
                  className={`
                    ${cell.occupiedBy === PLAYER_ID ? 'avatar-player' : 'avatar-npc'} 
                    ${attendees.find(a => a.id === cell.occupiedBy)?.color || 'bg-gray-500'}
                    ${attendees.find(a => a.id === cell.occupiedBy)?.isSeated ? 'animate-bounce-slow' : ''}
                  `}
                  style={{ width: CELL_SIZE * 0.7, height: CELL_SIZE * 0.7 }}
                ></div>
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initializeGame]);

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-4">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold mb-2">Conference Room Seat Chase</h1>
        <p className="text-lg text-gray-700 mb-4">
          Find a seat before the presentation starts!
        </p>
        
        <div className="flex justify-center space-x-4 mb-4">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
            <span>You</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-red-400 mr-2"></div>
            <span>Other Attendees</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-md bg-amber-800 mr-2"></div>
            <span>Chair</span>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-md p-4 mb-4">
        <div className="text-center mb-4">
          {gameOver ? (
            <p className="text-xl font-semibold text-green-600">
              Everyone is seated! Presentation starting.
            </p>
          ) : playerSeated ? (
            <p className="text-xl font-semibold text-blue-600">
              You found a seat! Waiting for others...
            </p>
          ) : (
            <p className="text-lg">
              Moves: <span className="font-bold">{movesCount}</span> | 
              Seated: <span className="font-bold">{attendees.filter(a => a.isSeated).length}</span> of {TOTAL_ATTENDEES}
            </p>
          )}
        </div>
        
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
          <li>Use arrow keys or buttons to move your character (blue circle)</li>
          <li>Navigate through the crowd to find an empty chair</li>
          <li>Once seated, wait for everyone else to find seats</li>
          <li>The game ends when all 48 attendees are seated</li>
        </ul>
      </div>
    </div>
  );
};

export default ConferenceRoom;
