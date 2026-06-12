export interface PieceData {
  id: string;
  x: number;
  y: number;
  length: number;
  orientation: 'horizontal' | 'vertical';
  type: 'shuttle' | 'cargo';
}

export interface Puzzle {
  id: number;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Very Difficult';
  pieces: PieceData[];
}

export const puzzles: Puzzle[] = [
  {
    id: 1,
    name: "Ensign's First Day",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 2, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 4, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 2,
    name: "Cargo Bay Logjam",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 1, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 3, y: 1, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 4, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 0, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 3,
    name: "Guidance System Check",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 2, y: 3, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 3, y: 1, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c4', x: 5, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 4,
    name: "Pallet Shuffle",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 0, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 3, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 4, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 5,
    name: "Magnetic Interference",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 1, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 0, y: 0, length: 3, orientation: 'horizontal', type: 'cargo' },
      { id: 'c2', x: 0, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 3, y: 1, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 4, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 6,
    name: "Transporter Buffer Full",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 4, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 2, y: 4, length: 3, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 7,
    name: "Docking Prep",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 2, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 1, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 4, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 0, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c4', x: 5, y: 3, length: 3, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 8,
    name: "Hangar Doors Jammed",
    difficulty: 'Easy',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 5, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 3, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c5', x: 1, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 9,
    name: "Red Alert",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'v1', x: 2, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'v2', x: 3, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'v3', x: 4, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'h1', x: 0, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'v4', x: 0, y: 3, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'h2', x: 1, y: 3, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'h3', x: 1, y: 5, length: 3, orientation: 'horizontal', type: 'cargo' },
      { id: 'v5', x: 4, y: 3, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'v6', x: 5, y: 3, length: 3, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 10,
    name: "Romulan Neutral Zone",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 4, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c4', x: 4, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 5, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 3, y: 3, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c7', x: 2, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 11,
    name: "Borg Cube Evasion",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 5, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 3, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 4, y: 3, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c6', x: 0, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 12,
    name: "Plasma Coil Short",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 1, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 5, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 3, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 4, y: 3, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c6', x: 0, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c7', x: 1, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 13,
    name: "Tractor Beam Tangle",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 1, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 0, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 1, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 3, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 4, y: 1, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c5', x: 0, y: 3, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c6', x: 2, y: 3, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c7', x: 4, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 14,
    name: "Dilithium Crystal Crisis",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c2', x: 4, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 5, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 2, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 3, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 4, y: 3, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c7', x: 0, y: 4, length: 3, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 15,
    name: "Nebula Navigation",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 1, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 0, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 1, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 3, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 4, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c5', x: 3, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 4, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c7', x: 5, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c8', x: 0, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 16,
    name: "Chroniton Flux",
    difficulty: 'Medium',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 5, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 3, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 4, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 0, y: 3, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c7', x: 1, y: 3, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c8', x: 2, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 17,
    name: "Kobayashi Maru",
    difficulty: 'Very Difficult',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 1, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 3, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 4, y: 2, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 5, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 0, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c7', x: 3, y: 4, length: 3, orientation: 'horizontal', type: 'cargo' },
      { id: 'c8', x: 2, y: 3, length: 2, orientation: 'horizontal', type: 'cargo' },
    ]
  },
  {
    id: 18,
    name: "Section 31 Clearance",
    difficulty: 'Very Difficult',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 1, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c3', x: 5, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c4', x: 0, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c5', x: 0, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 1, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c7', x: 2, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c8', x: 4, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 19,
    name: "Omega Directive",
    difficulty: 'Very Difficult',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 0, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 4, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c4', x: 0, y: 3, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 1, y: 3, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 2, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c7', x: 4, y: 2, length: 3, orientation: 'vertical', type: 'cargo' },
    ]
  },
  {
    id: 20,
    name: "Final Frontier",
    difficulty: 'Very Difficult',
    pieces: [
      { id: 'shuttle', x: 0, y: 2, length: 2, orientation: 'horizontal', type: 'shuttle' },
      { id: 'c1', x: 2, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c2', x: 3, y: 0, length: 3, orientation: 'vertical', type: 'cargo' },
      { id: 'c3', x: 4, y: 0, length: 2, orientation: 'horizontal', type: 'cargo' },
      { id: 'c4', x: 4, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c5', x: 5, y: 1, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c6', x: 0, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c7', x: 1, y: 4, length: 2, orientation: 'vertical', type: 'cargo' },
      { id: 'c8', x: 2, y: 4, length: 2, orientation: 'horizontal', type: 'cargo' },
    ]
  }
];
