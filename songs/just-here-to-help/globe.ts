// The Earth as a dark control-room globe, flat-shaded like everything else: an unlit sphere with a
// painted equirectangular map (navy sea, teal land, glowing city lights), an ink rim, a cel-shade
// crescent and a HUD ring, all as camera-facing cut-outs. Arcs (money, flight lanes, missiles) are
// flat-coloured tubes over the surface that can be drawn part-way. Bridge parts 2 to 4.
//
// Coordinates: lon/lat in degrees. The globe's map matches three's SphereGeometry UVs, so
// local(lon, lat) and the painted map agree.
import * as THREE from 'three';
import { INK, canvasPlane, circleShape, ownMat, shapeMesh } from '../../engine/flat';
import { hash } from '../../engine/rng';
import { clamp, lerp } from '../../engine/ease';
import { MONO } from './world';

type LL = [number, number];
// Hand-simplified coastlines, [lon, lat].
export const LAND: LL[][] = [
  // North America
  [[-168, 65], [-162, 70], [-156, 71.3], [-141, 69.6], [-128, 70.2], [-117, 68.9], [-108, 68.3], [-95, 68], [-94, 71.5], [-85, 69.5], [-81, 68.5], [-87, 64], [-93, 61], [-94, 58.7], [-90, 57], [-82, 55], [-79, 52], [-80, 57], [-77, 60], [-78, 62.5], [-72, 61.5], [-65, 60], [-61, 56], [-56, 52.5], [-59, 48], [-65, 49], [-70, 47], [-64, 47], [-61, 45.5], [-66, 44.5], [-70, 43.5], [-70, 41.7], [-74, 40.5], [-76, 38], [-76, 35], [-78, 33.8], [-81, 31.5], [-80, 27], [-80.4, 25.2], [-82, 26.5], [-83, 29], [-85, 30], [-89, 30.2], [-90, 29.2], [-94, 29.6], [-97, 27.8], [-97.5, 25], [-97.5, 21.5], [-96, 19], [-94.5, 18.2], [-91, 19], [-90.5, 21], [-87, 21.5], [-88, 18], [-88.5, 16], [-84, 15.8], [-83.4, 12], [-83.6, 10.5], [-81.5, 9], [-79.5, 9.5], [-77.5, 8.5], [-78, 7.5], [-80.5, 7.5], [-81.5, 8.2], [-85.5, 10], [-86, 11.5], [-87.6, 13], [-91.5, 14], [-94, 16], [-96.5, 15.7], [-101, 17.3], [-105.5, 20], [-105.2, 21.5], [-106.5, 23.2], [-109, 25.5], [-112.5, 30], [-114.5, 31.5], [-113, 29], [-112, 27], [-110, 24], [-110, 23], [-112, 24.8], [-114, 27.6], [-115, 30], [-117, 32.5], [-118.5, 34], [-120.6, 34.6], [-122.5, 37.5], [-124, 40.5], [-124.2, 43], [-124, 46.5], [-124.7, 48.4], [-123, 49], [-127.5, 50.5], [-130, 54], [-133, 57], [-136.5, 58.5], [-140, 59.8], [-145, 60.4], [-148, 60], [-152, 59], [-154, 57.5], [-157, 56.5], [-162, 55], [-164.5, 54.5], [-159, 58], [-162, 58.7], [-162, 60], [-165, 61], [-166, 62.5], [-164.5, 63.2], [-161, 64.5], [-166, 64.6]],
  // Arctic islands, Greenland
  [[-80, 73], [-72, 71], [-62, 67], [-65, 63], [-72, 63], [-78, 65], [-84, 69], [-90, 73]],
  [[-120, 73], [-105, 73], [-100, 77], [-80, 76], [-62, 82], [-90, 83], [-115, 77]],
  [[-73, 78], [-60, 76], [-55, 75], [-50, 70], [-53, 66], [-50, 62], [-44, 60], [-41, 62], [-38, 65], [-31, 68], [-22, 70], [-20, 75], [-18, 80], [-30, 83.5], [-50, 82.5], [-63, 81.5]],
  // Caribbean
  [[-84.9, 21.9], [-82, 23.2], [-77.5, 22], [-74.2, 20.2], [-77.7, 19.9], [-80, 21.7], [-82.6, 21.6]],
  [[-74.4, 18.5], [-72.8, 19.9], [-69.9, 19.6], [-68.4, 18.6], [-71.4, 17.6], [-72.7, 18.2]],
  // South America
  [[-77.5, 8.5], [-76, 9.5], [-75.5, 10.8], [-73, 11.5], [-71.5, 12.4], [-70, 11.5], [-68, 10.5], [-64, 10.7], [-61.5, 10.5], [-60, 8.5], [-57, 6], [-53, 5.5], [-51, 4], [-50, 1.5], [-48.5, -1], [-44, -2.5], [-40, -2.8], [-37, -4.8], [-35, -7], [-35, -9], [-37, -11.5], [-39, -15], [-39, -18], [-40, -20.5], [-42, -23], [-45, -23.7], [-48.5, -26], [-48.7, -28.5], [-50.5, -31], [-53, -34], [-55, -35], [-57.5, -35], [-57, -37], [-58, -38.5], [-62, -39], [-62.3, -40.8], [-65, -41], [-64, -42.5], [-65.5, -45], [-67.5, -46.5], [-66, -48], [-69, -50.5], [-68.5, -52.5], [-71, -54], [-74.5, -52], [-75.5, -47], [-74, -43], [-73.5, -37], [-71.5, -32], [-71.4, -28], [-70.5, -23], [-70.2, -18.5], [-72, -17], [-76, -14], [-77.5, -11], [-79.5, -7], [-81.2, -6], [-80.5, -3], [-80, -1], [-80.5, 1], [-78.8, 1.8], [-77.5, 4], [-77.3, 6.5]],
  // Eurasia
  [[-9, 37], [-8.8, 40], [-9.3, 43], [-8, 43.7], [-1.8, 43.4], [-1.2, 46], [-2.5, 47.3], [-4.7, 48], [-1.6, 48.6], [0, 49.5], [1.6, 50.2], [3, 51], [4.5, 51.8], [5, 53.2], [7, 53.6], [8.6, 53.9], [8.2, 55.5], [8.1, 57], [10.5, 57.7], [10.5, 56], [10, 55], [11, 54], [13.5, 54.2], [17, 54.7], [19.5, 54.4], [21, 55.5], [21, 57], [23.5, 57.2], [24, 58.5], [28, 59.5], [23, 59.8], [21.5, 61], [21.2, 63], [25, 65], [24, 65.8], [22, 65.5], [19, 63.5], [17.5, 62], [17, 60.7], [18.8, 60], [16.5, 57], [14.5, 56], [12.8, 55.5], [11.8, 57.5], [10.6, 59], [8, 58], [5.6, 58.5], [5, 61], [5.5, 62.5], [8.5, 63.5], [10.5, 64.5], [12.5, 66], [14, 67.5], [15.5, 68.6], [18, 69.6], [21.5, 70.2], [25, 71], [28, 71], [31, 70], [30, 69.5], [33, 69.3], [36, 69], [41, 67.5], [39, 66], [34, 66], [36.5, 64.6], [38, 64.5], [40, 64.5], [44, 66.4], [44, 68.5], [46, 68], [53, 68.5], [55, 68.5], [59, 68.7], [61, 69.8], [66, 69.5], [68, 70.5], [66.5, 71.5], [69, 73], [72.5, 72.8], [72.5, 71], [75, 72.2], [78, 72.3], [80, 73.5], [87, 74], [86, 75], [94, 76], [100, 76.5], [104, 77.7], [107, 76.8], [112, 76.3], [113, 73.7], [120, 73], [126, 73.5], [129, 71.5], [131.5, 71], [135, 71.6], [140, 72.5], [146, 72.3], [150, 71.5], [155, 71], [160, 70.8], [163, 69.6], [168, 69.8], [170, 70], [176, 69.8], [180, 69], [180, 65.5], [178, 64.5], [177, 62.5], [174, 61.8], [170, 60], [166, 59.8], [163, 59.9], [162.5, 58], [163.5, 56], [162, 54.5], [160, 53], [158, 51.5], [156.5, 51], [156, 53], [155.5, 56], [156.5, 57.5], [158.5, 58], [161, 60.5], [159, 61.7], [156, 61.5], [154, 59.5], [150, 59.6], [146, 59.2], [143, 59.3], [140.5, 58], [138, 56], [135.5, 54.7], [137.5, 54], [139, 52], [140.5, 50], [140, 48], [138, 46.5], [135.5, 43.7], [133, 42.8], [131, 42.5], [129.5, 41], [128, 39.5], [129.4, 36.8], [129.2, 35.2], [126.5, 34.4], [126.2, 36.7], [126.8, 37.7], [125, 38.5], [125.2, 39.6], [121.5, 39], [121.5, 40.9], [118, 39.2], [117.5, 38.5], [119, 37.2], [122.5, 37.3], [120.5, 36.1], [119.2, 34.8], [120.8, 32.6], [121.8, 31], [121.9, 29.8], [121.5, 28.3], [120.2, 26.7], [119.5, 25.5], [117, 23.6], [114, 22.3], [111, 21.5], [110, 20.3], [109.6, 21.7], [108, 21.5], [106.7, 20], [106, 18.5], [107.5, 16.5], [109, 15], [109.2, 11.6], [107, 10.5], [105.1, 8.6], [104.8, 10], [103, 11], [101, 12.6], [100, 13.5], [99.2, 10.5], [100.3, 8.5], [101, 6.8], [102, 6.2], [103.4, 4], [103.5, 1.4], [101.3, 2.8], [100.4, 5], [98.5, 8.2], [98.6, 10], [98.5, 13.2], [97.7, 16.5], [96, 16.8], [94.5, 16], [94, 18.8], [92.4, 20.7], [91.8, 22.5], [90.3, 21.8], [88.9, 21.6], [87, 21.5], [86.5, 20], [85, 19.3], [82.3, 17], [80.2, 15.2], [80.3, 13], [79.9, 10.3], [78.2, 8.9], [77, 8.2], [76.3, 9.5], [75.3, 12], [74.2, 14.8], [73, 18], [72.8, 21], [72.5, 21.5], [70.2, 20.9], [68.9, 22.4], [67.4, 23.9], [66.6, 25.4], [64, 25.2], [61.5, 25.1], [57.3, 25.8], [56.4, 27.1], [54, 26.5], [51.5, 27.9], [50, 30], [48, 30], [48.5, 28.6], [49.6, 27], [50.2, 26.3], [51.5, 24.4], [54, 24.2], [56.3, 26], [56.5, 24.5], [57.8, 23.6], [59.8, 22.5], [58.5, 20.4], [57.7, 19], [55.5, 17.7], [52.2, 16], [49, 14.5], [45, 13], [43.5, 12.7], [42.8, 15], [42.6, 16.8], [41.2, 19], [39, 21.5], [38.5, 23.8], [37, 25.6], [35.6, 27.8], [34.9, 29.5], [34.3, 27.8], [33.6, 28.3], [32.6, 30], [32.3, 31.3], [34.3, 31.3], [35, 33.1], [35.8, 34.6], [36, 35.8], [35.8, 36.8], [34, 36.3], [32.5, 36.1], [30.5, 36.4], [28.2, 36.7], [27.3, 37.4], [26.3, 38.3], [26.8, 39.5], [26.2, 40.6], [24, 40.8], [22.9, 40.5], [23.7, 39.8], [23, 38.2], [24, 38], [22.8, 37.5], [22.5, 36.5], [21.7, 36.9], [21.1, 38.3], [20.2, 39.7], [19.4, 41.8], [18.4, 42.5], [16.3, 43.5], [15.2, 44.3], [14.4, 45.1], [13.6, 45.6], [12.3, 45.2], [12.4, 44.2], [13.6, 43.5], [14.8, 42.1], [16.2, 41.7], [18.5, 40.1], [17.5, 40.3], [16.5, 39], [16.6, 38.4], [15.7, 37.9], [15.8, 38.8], [15.4, 40], [14.5, 40.6], [13, 41.2], [12, 41.9], [10.6, 42.9], [10.2, 43.9], [8.8, 44.4], [7.5, 43.8], [6.5, 43.1], [4.6, 43.4], [3.1, 43.1], [3.2, 41.9], [0.8, 41], [0, 39.9], [-0.3, 39.3], [0.2, 38.8], [-0.7, 37.6], [-2.1, 36.7], [-4.4, 36.7], [-5.6, 36], [-6.4, 36.8], [-7.4, 37.2], [-8.9, 36.9]],
  // islands of Europe and Asia
  [[-5.7, 50], [-3, 50.7], [1.3, 51.1], [1.7, 52.6], [0.2, 53.4], [-0.6, 54.5], [-1.6, 55.6], [-2.2, 56.8], [-1.8, 57.6], [-3.4, 57.7], [-5, 58.6], [-6.2, 57.5], [-5.6, 56.3], [-6.2, 55.4], [-4.6, 54.8], [-3.2, 54.5], [-3.4, 53.4], [-4.8, 52.8], [-4.2, 51.6], [-5.3, 51.7]],
  [[-10, 51.6], [-6.4, 52], [-6, 53.3], [-5.7, 54.6], [-7.3, 55.3], [-8.5, 54.5], [-10, 54.2], [-9.5, 52.9]],
  [[-24, 64.9], [-22, 66.4], [-16.5, 66.5], [-13.6, 65.6], [-14.5, 64.3], [-18.7, 63.4], [-22.7, 63.8]],
  [[130, 31.2], [131.3, 31.4], [132, 33], [133, 33.9], [135, 33.5], [136.8, 34.3], [138.8, 34.6], [140.3, 35.1], [140.9, 36.9], [141.5, 38.3], [142, 39.6], [141.4, 41.4], [140, 40.8], [139.9, 39.5], [139, 38], [137, 37], [136, 35.8], [133, 35.5], [131, 34.4], [129.6, 33.3]],
  [[140, 41.4], [141.2, 41.8], [143.3, 42], [145.5, 43.3], [144.3, 44.2], [141.9, 45.5], [141.4, 43.4], [140.4, 42.6]],
  [[142, 46], [143.5, 49.5], [143, 53.5], [142.5, 54.3], [142.2, 51], [141.9, 46.6]],
  [[120.1, 23], [121, 25.3], [122, 25], [120.9, 22]],
  [[120.6, 18.5], [122.3, 18.4], [122, 16], [124, 13], [121.8, 13.9], [120.6, 14.4], [120.1, 16.3]],
  [[122, 7], [125.3, 9.8], [126.5, 7.2], [125.4, 5.8], [124, 6.4], [122.1, 6.9]],
  [[79.8, 9.8], [81.8, 7.5], [81.2, 6.2], [80, 6], [79.7, 8]],
  [[95.3, 5.6], [97.5, 5.2], [100.4, 2.3], [104, -1], [106, -3], [105.8, -5.9], [104.6, -5.9], [102.3, -4], [100.9, -2], [98.6, 1.7], [96.4, 3.9]],
  [[105.2, -6.8], [108.5, -6.5], [111, -6.4], [114.5, -7.8], [112.5, -8.4], [108.7, -7.8], [106.4, -7.4]],
  [[109.6, 2], [111.2, 2.7], [113, 3.2], [115.5, 5.6], [117.3, 6.9], [119.2, 5.4], [118, 4.3], [118.3, 1.3], [117.4, 0.4], [116.6, -2.5], [116, -4], [114.5, -3.5], [111.7, -3.4], [110.2, -1.7], [109, 0.4]],
  [[119.4, -5.5], [120.4, -5.5], [121, -2.7], [123.3, -1], [124.8, 1.4], [120.8, 1.3], [119.7, 0], [118.8, -2.8]],
  [[131, -1.5], [134.1, -1], [137.8, -1.5], [141, -2.6], [145, -4.5], [147.6, -6], [148, -8], [150.3, -10.5], [147.2, -10.1], [144, -7.7], [141, -9.1], [138.9, -8.2], [137.8, -5.4], [134.2, -3.9], [132, -2.8]],
  // Africa, Madagascar
  [[-17.1, 14.7], [-16.7, 13], [-16.8, 12], [-15, 10.9], [-13.4, 9.3], [-12.5, 7.3], [-11, 6.5], [-7.5, 4.4], [-4, 5.2], [-2, 4.7], [1, 6], [2.7, 6.3], [4.4, 6.3], [6, 4.3], [8.5, 4.6], [9.6, 3.5], [9.4, 1], [9.3, -1], [11.1, -3.9], [12.2, -5.9], [13.2, -8.8], [13.6, -12], [12.4, -14], [11.8, -17], [12.8, -19.8], [14.4, -22.6], [15.2, -27], [16.5, -28.6], [18.2, -31.6], [18.4, -34], [20, -34.8], [22.6, -33.9], [25.8, -33.7], [27.5, -33.2], [30, -31], [31.5, -29.2], [32.5, -26.8], [32.6, -26], [35.3, -24], [35.5, -21], [34.7, -19.8], [36.5, -18.6], [39.5, -16.5], [40.6, -14.7], [40.5, -10.5], [39.5, -6.5], [39.2, -4.7], [40.9, -2.2], [41.9, -1], [43.5, 1], [45.8, 2.3], [47.8, 4.3], [49, 6], [51.2, 10.6], [51.1, 11.9], [49.5, 11.4], [48, 11.2], [45.5, 10.7], [43.3, 11.8], [42.7, 12.6], [41.2, 14.6], [39.3, 15.8], [38.5, 18], [37.4, 18.6], [37, 21], [36.7, 22.3], [35.5, 23.8], [34.5, 26], [33.6, 27.6], [32.6, 29.9], [32.3, 31.3], [30.2, 31.5], [28.9, 30.9], [25, 31.7], [23, 32.7], [20, 30.9], [19.1, 30.3], [17.5, 31], [15.4, 32.3], [13.2, 32.9], [11.5, 33.1], [10.3, 33.8], [11.1, 35.2], [10.2, 37.2], [8.4, 36.9], [5.4, 36.6], [2.6, 36.6], [0, 35.8], [-1.2, 35.7], [-2.2, 35.2], [-5.9, 35.8], [-6.8, 34.1], [-9.5, 32.6], [-9.8, 29.9], [-11.7, 28.1], [-13.6, 27.7], [-14.8, 26], [-16.3, 23.9], [-16.9, 22.3], [-17, 21], [-16.3, 19.6], [-16.2, 18.2], [-16.5, 16.1]],
  [[49.3, -12], [50.5, -15.2], [49.6, -17.1], [48.5, -20.5], [47.1, -24.9], [45.2, -25.6], [43.7, -23.5], [43.3, -21.8], [44.4, -19.9], [44, -17.4], [46.3, -15.8], [48, -13.6]],
  // Australia, Tasmania, New Zealand
  [[113.5, -22], [114.2, -26.2], [115, -29.5], [115.6, -33.6], [117, -35], [119.8, -34], [123.5, -33.9], [126, -32.3], [131, -31.5], [134, -32.8], [135.5, -34.8], [137.8, -33], [137.7, -35.3], [139.6, -36.2], [140.6, -38], [143.5, -38.8], [146.3, -39.1], [148.2, -37.8], [150, -37.4], [150.8, -34.7], [152.5, -32.4], [153.6, -28.7], [153.1, -25.6], [150.9, -22.6], [149.5, -21.6], [146.4, -18.9], [145.4, -16], [145.3, -14.8], [143.7, -14], [142.5, -10.7], [141.6, -12.8], [141.5, -15.5], [140.6, -17.5], [139.2, -17.3], [137.4, -15.9], [135.4, -14.7], [136.7, -12.3], [134.4, -12], [132.6, -11.5], [131, -12.2], [129.4, -14.4], [127.8, -14.3], [125.7, -14.4], [124.4, -16.3], [122.2, -17.8], [121.3, -19.5], [118.9, -20.3], [116.7, -20.6], [114.6, -21.8]],
  [[144.7, -40.7], [148.3, -40.9], [148, -43.2], [146, -43.6], [144.6, -41.9]],
  [[172.7, -34.4], [174.5, -36], [175.9, -37.2], [178.5, -37.7], [177, -39.3], [176, -41.3], [174.6, -41.3], [175.2, -40], [174, -39.3], [174.6, -38], [173, -35.3]],
  [[172.7, -40.5], [174.2, -41.5], [173.3, -43], [171.2, -44.5], [170.6, -45.9], [169, -46.6], [166.5, -46], [168.4, -44.1], [170.6, -43], [172, -41.6]],
  // Antarctica
  [[-180, -90], [-180, -78], [-160, -77.5], [-150, -76.5], [-140, -75], [-120, -73.5], [-100, -73.5], [-80, -73], [-75, -70], [-65, -68], [-58, -63.5], [-62, -66], [-60, -72], [-45, -78], [-30, -76], [-20, -73], [0, -70], [20, -70], [40, -69], [60, -67], [80, -67], [100, -66], [120, -66.5], [140, -66.8], [160, -70], [170, -72], [180, -78], [180, -90]],
];

export interface City { name: string; lon: number; lat: number }
export const CITIES: City[] = ([
  ['New York', -74, 40.7], ['Los Angeles', -118.2, 34], ['Chicago', -87.6, 41.9], ['Toronto', -79.4, 43.7], ['Mexico City', -99.1, 19.4],
  ['Houston', -95.4, 29.8], ['Miami', -80.2, 25.8], ['Vancouver', -123.1, 49.3], ['Anchorage', -149.9, 61.2], ['Sao Paulo', -46.6, -23.5],
  ['Rio', -43.2, -22.9], ['Buenos Aires', -58.4, -34.6], ['Lima', -77, -12], ['Bogota', -74.1, 4.7], ['Santiago', -70.7, -33.4],
  ['Reykjavik', -21.9, 64.1], ['London', -0.1, 51.5], ['Paris', 2.35, 48.85], ['Berlin', 13.4, 52.5], ['Madrid', -3.7, 40.4],
  ['Rome', 12.5, 41.9], ['Moscow', 37.6, 55.75], ['Istanbul', 29, 41], ['Cairo', 31.2, 30], ['Lagos', 3.4, 6.5],
  ['Johannesburg', 28, -26.2], ['Nairobi', 36.8, -1.3], ['Kinshasa', 15.3, -4.3], ['Dubai', 55.3, 25.2], ['Tehran', 51.4, 35.7],
  ['Riyadh', 46.7, 24.7], ['Karachi', 67, 24.9], ['Mumbai', 72.9, 19.1], ['Delhi', 77.2, 28.6], ['Lahore', 74.3, 31.5],
  ['Kolkata', 88.4, 22.6], ['Dhaka', 90.4, 23.8], ['Bangkok', 100.5, 13.75], ['Singapore', 103.8, 1.35], ['Jakarta', 106.8, -6.2],
  ['Manila', 121, 14.6], ['Hong Kong', 114.2, 22.3], ['Shanghai', 121.5, 31.2], ['Beijing', 116.4, 39.9], ['Chengdu', 104, 30.7],
  ['Seoul', 127, 37.6], ['Tokyo', 139.7, 35.7], ['Osaka', 135.5, 34.7], ['Novosibirsk', 82.9, 55], ['Sydney', 151.2, -33.9],
  ['Melbourne', 145, -37.8], ['Perth', 115.9, -32], ['Auckland', 174.8, -36.8],
] as [string, number, number][]).map(([name, lon, lat]) => ({ name, lon, lat }));
export const city = (name: string) => CITIES.find(c => c.name === name)!;

/** Where the painted map puts (lon, lat), in the spin group's space, at height alt above the surface. */
export function localPos(lon: number, lat: number, r: number, out = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(lon + 180), theta = THREE.MathUtils.degToRad(90 - lat);
  return out.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(r);
}

/** The map's state: everything that changes the painted texture. */
export interface MapState {
  /** 0..1 how far the red lines have run round each coastline. */
  borders: number;
  /** City i's light is off when cityOff(i) is true. */
  cityOff: (i: number) => boolean;
  /** 0..1 the land drains to ash grey (the ending). */
  ash: number;
}
const DEFAULT_MAP: MapState = { borders: 0, cityOff: () => false, ash: 0 };

/** A path over the globe from a to b (great circle), lifted to `peak` (in radii) in the middle. */
export interface Arc {
  mesh: THREE.Mesh;
  /** Draw only the part between k0 and k1 (0..1 along the path). */
  set(k0: number, k1: number): void;
  /** Point at k along the path, in the spin group's space. */
  at(k: number, out?: THREE.Vector3): THREE.Vector3;
}

export class Globe {
  readonly group = new THREE.Group();
  /** Tilts to the latitude being faced. */
  readonly tilt = new THREE.Group();
  /** Spins to the longitude being faced; put markers and arcs here so they turn with the Earth. */
  readonly spin = new THREE.Group();
  readonly R: number;
  private canvas: HTMLCanvasElement;
  private tex: THREE.CanvasTexture;
  private key = '';
  private rim: THREE.Mesh;
  private shade: THREE.Mesh;
  private halo: THREE.Mesh;
  private hud: ReturnType<typeof canvasPlane<number>>;
  hudOn = true;
  /** Extra camera-facing cut-outs placed like the rim: [object, distance toward camera in radii, scale vs silhouette]. */
  readonly extras: [THREE.Object3D, number, number][] = [];

  constructor(R = 3, size = 2048) {
    this.R = R;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size; this.canvas.height = size / 2;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 80), new THREE.MeshBasicMaterial({ map: this.tex }));
    this.spin.add(sphere);
    this.tilt.add(this.spin);
    this.group.add(this.tilt);
    // camera-facing cut-outs: an ink rim behind, a soft halo behind that, a shade crescent in front
    this.rim = shapeMesh(circleShape(1, 0, 0), INK, 0, 64);
    this.halo = shapeMesh(circleShape(1, 0, 0), ownMat('#5fd0ff', 0.12, true), 0, 64);
    const cres = new THREE.Shape(); cres.absarc(0, 0, 1, 0, Math.PI * 2, false);
    cres.holes.push((() => { const h = new THREE.Path(); h.absarc(-0.28, 0.16, 1.02, 0, Math.PI * 2, true); return h; })());
    this.shade = shapeMesh(cres, ownMat('#02040c', 0.38, true), 0, 64);
    this.hud = canvasPlane<number>(2, 2, 400, (c, t, W, H) => {
      const cx = W / 2, cy = H / 2, r0 = W * 0.36;
      c.strokeStyle = 'rgba(95,208,255,0.45)'; c.lineWidth = W * 0.003;
      c.beginPath(); c.arc(cx, cy, r0 * 1.08, 0, Math.PI * 2); c.stroke();
      for (let k = 0; k < 120; k++) {
        const a = k / 120 * Math.PI * 2 + t * 0.05, long = k % 10 === 0;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * r0 * 1.1, cy + Math.sin(a) * r0 * 1.1);
        c.lineTo(cx + Math.cos(a) * r0 * (long ? 1.16 : 1.13), cy + Math.sin(a) * r0 * (long ? 1.16 : 1.13)); c.stroke();
      }
      c.lineWidth = W * 0.006; c.strokeStyle = 'rgba(95,208,255,0.6)';
      for (let k = 0; k < 4; k++) {
        const a0 = k * Math.PI / 2 - t * 0.12;
        c.beginPath(); c.arc(cx, cy, r0 * 1.22, a0, a0 + 0.6); c.stroke();
      }
      c.fillStyle = 'rgba(127,216,255,0.75)'; c.font = `700 ${W * 0.016}px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + 0.85;
        c.fillText(`${(hash(k, Math.floor(t * 3)) * 90).toFixed(2)}°`, cx + Math.cos(a) * r0 * 1.28, cy + Math.sin(a) * r0 * 1.28);
      }
    });
    this.group.add(this.halo, this.rim, this.shade, this.hud.mesh);
    this.paint(DEFAULT_MAP);
  }

  /** Repaint the map (only when the state actually changes). */
  paint(s: Partial<MapState>) {
    const st = { ...DEFAULT_MAP, ...s };
    const off = CITIES.map((_, i) => (st.cityOff(i) ? 1 : 0)).join('');
    const key = `${Math.round(st.borders * 200)}|${off}|${Math.round(st.ash * 50)}`;
    if (key === this.key) return;
    this.key = key;
    const c = this.canvas.getContext('2d')!, W = this.canvas.width, H = this.canvas.height;
    const X = (lon: number) => (lon + 180) / 360 * W, Y = (lat: number) => (90 - lat) / 180 * H;
    const ash = st.ash;
    const mix = (a: string, b: string) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), ash).getHexString();
    c.fillStyle = mix('#0f2340', '#4a4a4a'); c.fillRect(0, 0, W, H);
    // graticule
    c.strokeStyle = mix('#18325a', '#555555'); c.lineWidth = W * 0.0012;
    for (let lon = -180; lon <= 180; lon += 15) { c.beginPath(); c.moveTo(X(lon), 0); c.lineTo(X(lon), H); c.stroke(); }
    for (let lat = -75; lat <= 75; lat += 15) { c.beginPath(); c.moveTo(0, Y(lat)); c.lineTo(W, Y(lat)); c.stroke(); }
    // land, with a lighter coastal band
    const path = (poly: LL[]) => { c.beginPath(); poly.forEach(([lon, lat], i) => (i ? c.lineTo(X(lon), Y(lat)) : c.moveTo(X(lon), Y(lat)))); c.closePath(); };
    for (const poly of LAND) {
      path(poly);
      c.fillStyle = mix('#1f5753', '#6b6b6b'); c.fill();
      c.strokeStyle = mix('#3fa3a0', '#7a7a7a'); c.lineWidth = W * 0.004; c.lineJoin = 'round'; c.stroke();
    }
    // red borders run round each coastline
    if (st.borders > 0) {
      c.strokeStyle = '#ff3b30'; c.lineWidth = W * 0.0035; c.lineJoin = 'round';
      for (const poly of LAND) {
        if (poly === LAND[LAND.length - 1]) continue;
        const n = Math.max(2, Math.ceil(poly.length * clamp(st.borders)));
        c.beginPath();
        for (let i = 0; i < n; i++) { const [lon, lat] = poly[i % poly.length]; if (i) c.lineTo(X(lon), Y(lat)); else c.moveTo(X(lon), Y(lat)); }
        if (st.borders >= 1) c.closePath();
        c.stroke();
      }
    }
    // city lights
    CITIES.forEach((ct, i) => {
      if (st.cityOff(i)) {
        c.fillStyle = 'rgba(10,14,24,0.9)';
        c.beginPath(); c.arc(X(ct.lon), Y(ct.lat), W * 0.0025, 0, Math.PI * 2); c.fill();
        return;
      }
      const x = X(ct.lon), y = Y(ct.lat);
      const g = c.createRadialGradient(x, y, 0, x, y, W * 0.012);
      g.addColorStop(0, 'rgba(255,217,138,0.75)'); g.addColorStop(1, 'rgba(255,217,138,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, W * 0.012, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff1c4'; c.beginPath(); c.arc(x, y, W * 0.0028, 0, Math.PI * 2); c.fill();
      for (let k = 0; k < 6; k++) {
        c.fillStyle = 'rgba(255,217,138,0.8)';
        c.fillRect(x + (hash(i, k, 901) - 0.5) * W * 0.012, y + (hash(i, k, 902) - 0.5) * W * 0.008, W * 0.0012, W * 0.0012);
      }
    });
    this.tex.needsUpdate = true;
  }

  /** Turn so (lon, lat) faces +z (the camera, if it looks down -z at the globe). */
  face(lon: number, lat: number) {
    this.spin.rotation.y = Math.PI / 2 - THREE.MathUtils.degToRad(lon + 180);
    this.tilt.rotation.x = THREE.MathUtils.degToRad(lat);
  }

  /** Point the cut-outs at the camera and size them to the sphere's silhouette. Call after moving things. */
  billboard(camera: THREE.Camera, t: number) {
    const centre = this.group.getWorldPosition(new THREE.Vector3());
    const camPos = camera.getWorldPosition(new THREE.Vector3());
    const D = centre.distanceTo(camPos);
    const ang = Math.asin(Math.min(0.999, this.R / D));
    const dir = camPos.clone().sub(centre).normalize();
    const place = (m: THREE.Object3D, dist: number, scale: number) => {
      // dist: from the centre toward the camera; scale relative to the silhouette at that depth
      const d = D - dist;
      m.position.copy(dir).multiplyScalar(dist);
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(d * Math.tan(ang) * scale);
    };
    place(this.rim, -this.R * 0.05, 1.025);
    place(this.halo, -this.R * 0.1, 1.12);
    place(this.shade, this.R * 1.01, 1.0);
    place(this.hud.mesh, -this.R * 0.15, 1.42);
    for (const [m, dist, scale] of this.extras) place(m, this.R * dist, scale);
    this.hud.mesh.visible = this.hudOn;
    if (this.hudOn) this.hud.update(t);
    this.group.updateMatrixWorld(true);
  }

  /** A flat-coloured tube from a to b, drawn part-way with set(k0, k1). Lives in the spin group. */
  arc(a: LL, b: LL, peak: number, color: string, radius = 0.025, segs = 80): Arc {
    const pa = localPos(a[0], a[1], 1), pb = localPos(b[0], b[1], 1);
    const omega = Math.acos(clamp(pa.dot(pb), -1, 1));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const k = i / segs;
      const s = Math.sin(omega) < 1e-4 ? pa.clone() : pa.clone().multiplyScalar(Math.sin((1 - k) * omega) / Math.sin(omega)).add(pb.clone().multiplyScalar(Math.sin(k * omega) / Math.sin(omega)));
      pts.push(s.normalize().multiplyScalar(this.R * (1.004 + peak * Math.sin(k * Math.PI))));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const radial = 6;
    const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
    const mesh = new THREE.Mesh(geo, ownMat(color));
    this.spin.add(mesh);
    const per = radial * 6;
    return {
      mesh,
      set(k0, k1) {
        const i0 = Math.floor(clamp(k0) * segs), i1 = Math.ceil(clamp(k1) * segs);
        mesh.visible = i1 > i0;
        geo.setDrawRange(i0 * per, Math.max(0, i1 - i0) * per);
      },
      at(k, out = new THREE.Vector3()) { return out.copy(curve.getPointAt(clamp(k))); },
    };
  }
}

/** A starfield backdrop for globe shots: a big static plane far behind. */
export function starfield(w = 90, h = 52) {
  const c = document.createElement('canvas');
  c.width = 1800; c.height = 1040;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(900, 520, 0, 900, 520, 1000);
  grad.addColorStop(0, '#0d1530'); grad.addColorStop(1, '#04060f');
  g.fillStyle = grad; g.fillRect(0, 0, 1800, 1040);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(220,230,255,${0.2 + hash(i, 911) * 0.7})`;
    const s = hash(i, 912) > 0.95 ? 3 : 1.6;
    g.fillRect(hash(i, 913) * 1800, hash(i, 914) * 1040, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

export const lerpLL = (a: LL, b: LL, k: number): LL => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
