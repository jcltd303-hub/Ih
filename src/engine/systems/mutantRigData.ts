/**
 * Generated Paper Cutout Skeletal Rig Metadata for Mutant Fish.
 * Sliced with convex joint overlap caps for 100% gapless fluid rotation.
 */

export interface PartFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PartRigDef {
  name: string;
  frame: PartFrame;
  anchor: { x: number; y: number };
  zOrder: number;
  parent: string | null;
  attachOffset: { x: number; y: number };
  rotationRange: [number, number];
}

export const MUTANT_RIG_ATLAS_SIZE = { width: 2048, height: 1536 };

export const MUTANT_RIG_PARTS: Record<string, PartRigDef> = {
  "dorsal_fin": {
    "name": "Dorsal Fin",
    "frame": {
      "x": 16,
      "y": 16,
      "w": 468,
      "h": 340
    },
    "anchor": {
      "x": 0.485,
      "y": 0.6441
    },
    "zOrder": 1,
    "parent": "torso",
    "attachOffset": {
      "x": 10,
      "y": -140
    },
    "rotationRange": [
      -0.18,
      0.22
    ]
  },
  "tail_fin": {
    "name": "Tail Fin",
    "frame": {
      "x": 500,
      "y": 16,
      "w": 298,
      "h": 549
    },
    "anchor": {
      "x": 0.2013,
      "y": 0.4353
    },
    "zOrder": 2,
    "parent": "tail_peduncle",
    "attachOffset": {
      "x": 160,
      "y": 0
    },
    "rotationRange": [
      -0.35,
      0.35
    ]
  },
  "tail_peduncle": {
    "name": "Tail Peduncle",
    "frame": {
      "x": 814,
      "y": 16,
      "w": 246,
      "h": 419
    },
    "anchor": {
      "x": 0.2642,
      "y": 0.4749
    },
    "zOrder": 3,
    "parent": "torso",
    "attachOffset": {
      "x": 220,
      "y": 10
    },
    "rotationRange": [
      -0.25,
      0.25
    ]
  },
  "leg_rear_lower": {
    "name": "Rear Lower Leg & Clawed Foot",
    "frame": {
      "x": 1076,
      "y": 16,
      "w": 159,
      "h": 218
    },
    "anchor": {
      "x": 0.2516,
      "y": 0.1835
    },
    "zOrder": 4,
    "parent": "leg_rear_upper",
    "attachOffset": {
      "x": 25,
      "y": 120
    },
    "rotationRange": [
      -0.3,
      0.4
    ]
  },
  "leg_rear_upper": {
    "name": "Rear Upper Thigh",
    "frame": {
      "x": 1251,
      "y": 16,
      "w": 126,
      "h": 155
    },
    "anchor": {
      "x": 0.3571,
      "y": 0.2903
    },
    "zOrder": 5,
    "parent": "torso",
    "attachOffset": {
      "x": 160,
      "y": 140
    },
    "rotationRange": [
      -0.2,
      0.3
    ]
  },
  "arm_front_lower": {
    "name": "Front Forearm & Claws",
    "frame": {
      "x": 1393,
      "y": 16,
      "w": 124,
      "h": 183
    },
    "anchor": {
      "x": 0.3065,
      "y": 0.2077
    },
    "zOrder": 9,
    "parent": "arm_front_upper",
    "attachOffset": {
      "x": 35,
      "y": 130
    },
    "rotationRange": [
      -0.35,
      0.35
    ]
  },
  "arm_front_upper": {
    "name": "Front Upper Arm",
    "frame": {
      "x": 1533,
      "y": 16,
      "w": 146,
      "h": 170
    },
    "anchor": {
      "x": 0.3082,
      "y": 0.2647
    },
    "zOrder": 8,
    "parent": "torso",
    "attachOffset": {
      "x": -70,
      "y": 130
    },
    "rotationRange": [
      -0.25,
      0.35
    ]
  },
  "ventral_finlet": {
    "name": "Ventral Finlet",
    "frame": {
      "x": 1695,
      "y": 16,
      "w": 90,
      "h": 136
    },
    "anchor": {
      "x": 0.4333,
      "y": 0.2574
    },
    "zOrder": 7,
    "parent": "torso",
    "attachOffset": {
      "x": -110,
      "y": 160
    },
    "rotationRange": [
      -0.2,
      0.25
    ]
  },
  "jaw_lower": {
    "name": "Articulated Lower Jaw",
    "frame": {
      "x": 16,
      "y": 581,
      "w": 453,
      "h": 340
    },
    "anchor": {
      "x": 0.8764,
      "y": 0.1618
    },
    "zOrder": 10,
    "parent": "head_upper",
    "attachOffset": {
      "x": -40,
      "y": 85
    },
    "rotationRange": [
      -0.05,
      0.42
    ]
  },
  "head_upper": {
    "name": "Head & Upper Cranium",
    "frame": {
      "x": 485,
      "y": 581,
      "w": 398,
      "h": 260
    },
    "anchor": {
      "x": 0.8719,
      "y": 0.6885
    },
    "zOrder": 6,
    "parent": "torso",
    "attachOffset": {
      "x": -190,
      "y": -10
    },
    "rotationRange": [
      -0.12,
      0.12
    ]
  },
  "torso": {
    "name": "Main Torso Body",
    "frame": {
      "x": 899,
      "y": 581,
      "w": 420,
      "h": 400
    },
    "anchor": {
      "x": 0.5214,
      "y": 0.5475
    },
    "zOrder": 0,
    "parent": null,
    "attachOffset": {
      "x": 0,
      "y": 0
    },
    "rotationRange": [
      -0.1,
      0.1
    ]
  }
};
