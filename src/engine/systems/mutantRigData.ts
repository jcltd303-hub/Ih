/**
 * Generated Paper Cutout Skeletal Rig Metadata for Mutant Fish.
 * Sliced with convex joint overlap caps for 100% gapless fluid rotation.
 * Source artwork: abyssal amphibious mutant fish (regenerated 2026-09).
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

export const MUTANT_RIG_ATLAS_SIZE = { width: 1272, height: 559 };

export const MUTANT_RIG_PARTS: Record<string, PartRigDef> = {
  "dorsal_fin": {
    "name": "Dorsal Fin",
    "frame": {
      "x": 860,
      "y": 10,
      "w": 186,
      "h": 87
    },
    "anchor": {
      "x": 0.4667,
      "y": 0.75
    },
    "zOrder": 1,
    "parent": "torso",
    "attachOffset": {
      "x": -43.5,
      "y": -77.6
    },
    "rotationRange": [
      -0.18,
      0.22
    ]
  },
  "tail_fin": {
    "name": "Tail Fin",
    "frame": {
      "x": 10,
      "y": 268,
      "w": 141,
      "h": 255
    },
    "anchor": {
      "x": 0.1322,
      "y": 0.4146
    },
    "zOrder": 2,
    "parent": "tail_peduncle",
    "attachOffset": {
      "x": 80.7,
      "y": 0.0
    },
    "rotationRange": [
      -0.35,
      0.35
    ]
  },
  "tail_peduncle": {
    "name": "Tail Peduncle",
    "frame": {
      "x": 1056,
      "y": 10,
      "w": 99,
      "h": 143
    },
    "anchor": {
      "x": 0.0625,
      "y": 0.3478
    },
    "zOrder": 3,
    "parent": "torso",
    "attachOffset": {
      "x": 149.1,
      "y": 0.0
    },
    "rotationRange": [
      -0.25,
      0.25
    ]
  },
  "leg_rear_lower": {
    "name": "Rear Lower Leg & Clawed Foot",
    "frame": {
      "x": 551,
      "y": 268,
      "w": 124,
      "h": 108
    },
    "anchor": {
      "x": 0.325,
      "y": 0.1149
    },
    "zOrder": 4,
    "parent": "leg_rear_upper",
    "attachOffset": {
      "x": 9.3,
      "y": 52.8
    },
    "rotationRange": [
      -0.3,
      0.4
    ]
  },
  "leg_rear_upper": {
    "name": "Rear Upper Thigh",
    "frame": {
      "x": 435,
      "y": 268,
      "w": 81,
      "h": 65
    },
    "anchor": {
      "x": 0.3077,
      "y": 0.0952
    },
    "zOrder": 5,
    "parent": "torso",
    "attachOffset": {
      "x": 55.9,
      "y": 102.5
    },
    "rotationRange": [
      -0.2,
      0.3
    ]
  },
  "arm_front_lower": {
    "name": "Front Forearm & Claws",
    "frame": {
      "x": 264,
      "y": 268,
      "w": 118,
      "h": 108
    },
    "anchor": {
      "x": 0.3947,
      "y": 0.0575
    },
    "zOrder": 9,
    "parent": "arm_front_upper",
    "attachOffset": {
      "x": 12.4,
      "y": 43.5
    },
    "rotationRange": [
      -0.35,
      0.35
    ]
  },
  "arm_front_upper": {
    "name": "Front Upper Arm",
    "frame": {
      "x": 161,
      "y": 268,
      "w": 87,
      "h": 62
    },
    "anchor": {
      "x": 0.25,
      "y": 0.1
    },
    "zOrder": 8,
    "parent": "torso",
    "attachOffset": {
      "x": -65.2,
      "y": 105.6
    },
    "rotationRange": [
      -0.25,
      0.35
    ]
  },
  "ventral_finlet": {
    "name": "Ventral Finlet",
    "frame": {
      "x": 698,
      "y": 268,
      "w": 81,
      "h": 84
    },
    "anchor": {
      "x": 0.4615,
      "y": 0.1111
    },
    "zOrder": 7,
    "parent": "torso",
    "attachOffset": {
      "x": -130.4,
      "y": 108.7
    },
    "rotationRange": [
      -0.2,
      0.25
    ]
  },
  "jaw_lower": {
    "name": "Articulated Lower Jaw",
    "frame": {
      "x": 670,
      "y": 10,
      "w": 180,
      "h": 137
    },
    "anchor": {
      "x": 0.8276,
      "y": 0.1364
    },
    "zOrder": 10,
    "parent": "head_upper",
    "attachOffset": {
      "x": -21.7,
      "y": 62.1
    },
    "rotationRange": [
      -0.05,
      0.42
    ]
  },
  "head_upper": {
    "name": "Head & Upper Cranium",
    "frame": {
      "x": 480,
      "y": 10,
      "w": 180,
      "h": 174
    },
    "anchor": {
      "x": 0.9483,
      "y": 0.4643
    },
    "zOrder": 6,
    "parent": "torso",
    "attachOffset": {
      "x": -177.0,
      "y": -24.8
    },
    "rotationRange": [
      -0.12,
      0.12
    ]
  },
  "torso": {
    "name": "Main Torso Body",
    "frame": {
      "x": 10,
      "y": 10,
      "w": 460,
      "h": 248
    },
    "anchor": {
      "x": 0.5676,
      "y": 0.475
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
