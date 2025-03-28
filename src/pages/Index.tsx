
import React from 'react';
import ConferenceRoom from '../components/ConferenceRoom';

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <style>
        {`
        .grid-cell {
          border: 1px solid #ccc;
        }
        .wall {
          background-color: #333;
        }
        .hallway {
          background-color: #d1d5db;
        }
        .carpet {
          background-color: #9ca3af;
        }
        .aisle {
          background-color: #6b7280;
        }
        .row-aisle {
          background-color: #818cf8;
        }
        .chair {
          width: 70%;
          height: 70%;
          background-color: #92400e;
          margin: auto;
          border-radius: 4px;
        }
        .podium {
          background-color: #78350f;
        }
        .avatar-player, .avatar-npc {
          border-radius: 50%;
          margin: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          color: black;
          font-weight: bold;
        }
        .animate-bounce-slow {
          animation: bounce 1s infinite;
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        `}
      </style>
      <ConferenceRoom />
    </div>
  );
};

export default Index;
