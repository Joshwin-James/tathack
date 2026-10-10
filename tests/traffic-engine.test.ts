import { TrafficEngine } from '../src/components/city-3d-map/engine';
import { FIXED_DT } from '../src/components/city-3d-map/constants';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('PROJECT SENTINEL: TRAFFIC ENGINE VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`[PASS] Test ${passed + failed + 1}: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] Test ${passed + failed + 1}: ${name}`);
      console.error(err.stack);
      failed++;
    }
  }

  // Helper to advance engine by seconds
  function step(engine: TrafficEngine, seconds: number) {
    const ticks = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < ticks; i++) {
      engine.update(FIXED_DT);
    }
  }

  // 1. A vehicle approaching a red light stops before the stop line
  test('Vehicle approaching a red light stops before the stop line', () => {
    const engine = new TrafficEngine();
    engine.reset();
    // In initial state, NS is green, EW is red.
    // Spawn a vehicle on East approach (facing red light)
    const v = engine.spawnVehicle('east', 'straight', 'car')!;
    assert(v !== null, 'Vehicle should spawn');
    
    // Position it 50m before stop line
    const stopDist = engine.stopLineDistance(v);
    v.distance = stopDist - 50;
    v.speed = 10;

    // Run for 8 seconds
    step(engine, 8);

    assert(v.speed < 0.1, `Vehicle should come to complete stop, speed is ${v.speed}`);
    assert(v.distance <= stopDist, `Vehicle should stop before stop line, distance: ${v.distance}, stopDist: ${stopDist}`);
    assert(v.stopReason === 'RED_SIGNAL', `Stop reason should be RED_SIGNAL, got ${v.stopReason}`);
  });

  // 2. The same vehicle starts moving after its applicable signal becomes green
  test('Vehicle starts moving after applicable signal becomes green', () => {
    const engine = new TrafficEngine();
    engine.reset();
    const v = engine.spawnVehicle('east', 'straight', 'car')!;
    const stopDist = engine.stopLineDistance(v);
    v.distance = stopDist - 0.2;
    v.speed = 0;

    // Initially EW is red
    assert(engine.getSignalState('east') === 'red', 'East signal must be red initially');
    step(engine, 1);
    assert(v.speed === 0, 'Vehicle must remain stopped while signal is red');

    // Force phase change to EW_GREEN
    engine.controllerPhase = 'EW_GREEN';
    engine.phaseTimer = 0;
    engine.currentGreenDuration = 20;
    // Update one tick
    engine.update(FIXED_DT);

    assert(engine.getSignalState('east') === 'green', 'East signal should now be green');
    
    // Step forward 1.5 seconds
    step(engine, 1.5);

    assert(v.speed > 2.0, `Vehicle should accelerate on green, current speed: ${v.speed} m/s`);
    assert(v.distance > stopDist, `Vehicle should cross the stop line, distance: ${v.distance}, stopDist: ${stopDist}`);
  });

  // 3. A queue of multiple cars advances one vehicle at a time
  test('A queue of multiple cars advances sequentially with safe spacing', () => {
    const engine = new TrafficEngine();
    engine.reset();

    const stopDist = engine.stopLineDistance();
    // Spawn 3 cars on East (red light)
    const c1 = engine.spawnVehicle('east', 'straight', 'car')!;
    const c2 = engine.spawnVehicle('east', 'straight', 'car')!;
    const c3 = engine.spawnVehicle('east', 'straight', 'car')!;

    c1.distance = stopDist - 0.2;
    c1.speed = 0;
    c2.distance = stopDist - 6.5;
    c2.speed = 0;
    c3.distance = stopDist - 13.0;
    c3.speed = 0;

    // Verify all 3 are stopped safely
    step(engine, 1);
    assert(c1.speed === 0 && c2.speed === 0 && c3.speed === 0, 'All cars should be queued and stationary');

    // Switch East to green
    engine.controllerPhase = 'EW_GREEN';
    engine.phaseTimer = 0;
    engine.currentGreenDuration = 25;
    engine.update(FIXED_DT);

    // After 0.5s: c1 starts moving first
    step(engine, 0.5);
    assert(c1.speed > 1.0, `Lead car should start moving first (speed: ${c1.speed})`);

    // After 2.5s: c2 follows, then c3
    step(engine, 2.0);
    assert(c2.speed > 1.0, `Second car should follow lead car (speed: ${c2.speed})`);
    assert(c2.distance < c1.distance, 'Second car must maintain order behind lead car');

    step(engine, 2.0);
    assert(c3.speed > 1.0, `Third car should follow in sequence (speed: ${c3.speed})`);
    assert(c3.distance < c2.distance, 'Third car must maintain order behind second car');
  });

  // 4. A bus at the front of the queue does not permanently block following traffic
  test('Bus at front of queue moves and clears queue smoothly', () => {
    const engine = new TrafficEngine();
    engine.reset();

    const stopDist = engine.stopLineDistance();
    const bus = engine.spawnVehicle('north', 'straight', 'bus')!;
    const car = engine.spawnVehicle('north', 'straight', 'car')!;

    bus.distance = stopDist - 0.3;
    bus.speed = 0;
    car.distance = stopDist - 12.0; // Behind 10.5m bus
    car.speed = 0;

    // NS is green!
    assert(engine.getSignalState('north') === 'green', 'North should be green');

    // Step 3 seconds
    step(engine, 3.0);

    assert(bus.speed > 3.0, `Bus should accelerate (speed: ${bus.speed})`);
    assert(car.speed > 2.0, `Car behind bus should follow smoothly (speed: ${car.speed})`);
    assert(bus.distance > stopDist, 'Bus should cross into intersection');
  });

  // 5. A vehicle behind another vehicle waits safely and moves when space opens
  test('Vehicle behind another vehicle waits safely and moves when space opens', () => {
    const engine = new TrafficEngine();
    engine.reset();

    const v1 = engine.spawnVehicle('north', 'straight', 'car')!;
    const v2 = engine.spawnVehicle('north', 'straight', 'car')!;

    // v1 is a stalled vehicle in lane
    v1.distance = 200;
    v1.speed = 0;
    v1.spec.maxSpeed = 0;
    v2.distance = 180;
    v2.speed = 10;

    step(engine, 4);

    assert(v2.speed === 0, `v2 must stop behind v1, got speed ${v2.speed}`);
    const gap = v1.distance - v2.distance - v1.spec.length / 2 - v2.spec.length / 2;
    assert(gap >= 1.5 && gap <= 3.5, `v2 must maintain safe bumper gap, got gap ${gap.toFixed(2)}m`);
    assert(v2.stopReason === 'VEHICLE_AHEAD', `v2 stopReason should be VEHICLE_AHEAD, got ${v2.stopReason}`);

    // Now v1 resumes moving
    v1.spec.maxSpeed = 14;
    v1.speed = 8;
    step(engine, 2);

    assert(v2.speed > 1.0, `v2 should accelerate when v1 moves, got speed ${v2.speed}`);
  });

  // 6. A vehicle with an invalid route is diagnosed rather than silently frozen
  test('Vehicle with an invalid route is diagnosed with INVALID_ROUTE', () => {
    const engine = new TrafficEngine();
    engine.reset();

    const v = engine.spawnVehicle('north', 'straight', 'car')!;
    (v as any).path = null; // Corrupt path

    engine.update(FIXED_DT);

    assert(v.stopReason === 'INVALID_ROUTE', `Should be diagnosed with INVALID_ROUTE, got ${v.stopReason}`);
    assert(v.speed === 0, 'Corrupted route vehicle should be halted safely');
  });

  // 7. A vehicle cannot enter an occupied or conflicting intersection
  test('Vehicle yields when cross-traffic vehicle occupies the junction', () => {
    const engine = new TrafficEngine();
    engine.reset();

    const stopDist = engine.stopLineDistance();
    // North is green, East bus is stalled inside the intersection box
    const blocker = engine.spawnVehicle('east', 'straight', 'bus')!;
    blocker.phase = 'intersection';
    blocker.distance = stopDist + 8; // Inside the box
    blocker.position.set(0, 0, 0);
    blocker.speed = 0;
    blocker.spec.maxSpeed = 0; // Stalled in box

    const entrant = engine.spawnVehicle('north', 'straight', 'car')!;
    entrant.distance = stopDist - 1.0;
    entrant.speed = 5;

    // Check yellow box logic
    const check = engine.isJunctionBlockedFor(entrant);
    assert(check.blocked === true, 'Junction must report blocked by cross-traffic blocker');
    assert(check.reason === 'INTERSECTION_OCCUPIED', `Reason should be INTERSECTION_OCCUPIED, got ${check.reason}`);

    step(engine, 1);
    assert(entrant.distance <= stopDist, 'Entrant must hold before stop line while junction is occupied');
  });

  // 8. A vehicle cannot enter a full downstream road
  test('Vehicle holds at stop line on green when downstream exit is blocked', () => {
    const engine = new TrafficEngine();
    engine.reset();

    // Block South exit road
    engine.setDownstreamBlock('south', true);

    const stopDist = engine.stopLineDistance();
    // Place a stopped queue on the South exit road
    const stoppedExit = engine.spawnVehicle('north', 'straight', 'car')!;
    stoppedExit.phase = 'exit';
    stoppedExit.distance = engine.intersectionExitDistance(stoppedExit) + 5;
    stoppedExit.speed = 0;
    stoppedExit.spec.maxSpeed = 0;

    // Incoming vehicle from North heading straight to South
    const entrant = engine.spawnVehicle('north', 'straight', 'car')!;
    entrant.distance = stopDist - 2.0;
    entrant.speed = 8;

    step(engine, 2);

    assert(entrant.distance <= stopDist, 'Vehicle must not block the box if downstream exit is full');
    assert(entrant.stopReason === 'DOWNSTREAM_BLOCKED', `Reason should be DOWNSTREAM_BLOCKED, got ${entrant.stopReason}`);
  });

  // 9. Intersection occupancy clears after a vehicle exits
  test('Intersection occupancy clears after vehicle exits', () => {
    const engine = new TrafficEngine();
    engine.reset();

    const stopDist = engine.stopLineDistance();
    const clearingVehicle = engine.spawnVehicle('east', 'straight', 'car')!;
    clearingVehicle.phase = 'intersection';
    clearingVehicle.distance = stopDist + 5;
    clearingVehicle.position.set(0, 0, 0);

    const waiting = engine.spawnVehicle('north', 'straight', 'car')!;
    waiting.distance = stopDist - 1.0;
    waiting.speed = 0;

    assert(engine.isJunctionBlockedFor(waiting).blocked === true, 'Initially blocked');

    // Move clearingVehicle out to exit phase
    clearingVehicle.phase = 'exit';
    clearingVehicle.distance = engine.intersectionExitDistance(clearingVehicle) + 50;
    clearingVehicle.position.set(200, 0, 0);

    assert(engine.isJunctionBlockedFor(waiting).blocked === false, 'Should be clear once vehicle exits box');
  });

  // 10. The displayed green state and vehicle-observed green state remain consistent
  test('Displayed signal state and vehicle observed state are 100% consistent', () => {
    const engine = new TrafficEngine();
    engine.reset();

    const vNorth = engine.spawnVehicle('north', 'straight', 'car')!;
    const vEast = engine.spawnVehicle('east', 'straight', 'car')!;

    const snapshot = engine.getSnapshot();
    assert(snapshot.signals.north === 'green', 'UI snapshot North should be green');
    assert(snapshot.signals.east === 'red', 'UI snapshot East should be red');

    assert(engine.getSignalState(vNorth.path.approach) === 'green', 'Vehicle North sees green');
    assert(engine.getSignalState(vEast.path.approach) === 'red', 'Vehicle East sees red');

    // Force transition to EW green
    engine.controllerPhase = 'EW_GREEN';
    engine.phaseTimer = 0;
    engine.update(FIXED_DT);

    const snapshot2 = engine.getSnapshot();
    assert(snapshot2.signals.north === 'red', 'UI snapshot North should be red after transition');
    assert(snapshot2.signals.east === 'green', 'UI snapshot East should be green after transition');
    assert(engine.getSignalState(vNorth.path.approach) === 'red', 'Vehicle North sees red');
    assert(engine.getSignalState(vEast.path.approach) === 'green', 'Vehicle East sees green');
  });

  // 11. Adaptive phase changes release the appropriate queues
  test('Adaptive controller allocates green time to heavy queues', () => {
    const engine = new TrafficEngine();
    engine.reset();
    engine.setMode('adaptive');

    // Create 6 vehicles queued on East approach
    const stopDist = engine.stopLineDistance();
    for (let i = 0; i < 6; i++) {
      const v = engine.spawnVehicle('east', 'straight', 'car')!;
      v.distance = stopDist - 2 - i * 6;
      v.speed = 0;
      v.waitingTime = 15;
    }

    engine.update(FIXED_DT);
    const allocated = engine.calculateAdaptiveGreenDuration(['east', 'west']);
    assert(allocated >= 20, `Allocated green for 6 queued cars should be >= 20s, got ${allocated}s`);
  });

  // 12. Yellow and all-red transitions do not release conflicting movements
  test('All-red clearance interval holds all signals red to prevent T-bone collisions', () => {
    const engine = new TrafficEngine();
    engine.reset();

    // Trigger all-red phase
    engine.controllerPhase = 'NS_ALL_RED';
    engine.phaseTimer = 0.5;
    engine.update(FIXED_DT);

    assert(engine.getSignalState('north') === 'red', 'North must be red during ALL_RED');
    assert(engine.getSignalState('south') === 'red', 'South must be red during ALL_RED');
    assert(engine.getSignalState('east') === 'red', 'East must be red during ALL_RED');
    assert(engine.getSignalState('west') === 'red', 'West must be red during ALL_RED');
  });

  // 13. Reset restores vehicles, signals, timers, and occupancy to consistent initial states
  test('Reset restores entire engine to clean baseline state', () => {
    const engine = new TrafficEngine();
    // Pollute state
    for (let i = 0; i < 15; i++) {
      engine.spawnVehicle('north');
      engine.spawnVehicle('east');
    }
    step(engine, 10);
    assert(engine.vehicles.length > 0, 'Vehicles should be active before reset');

    engine.reset();

    assert(engine.vehicles.length === 0, 'Vehicle list must be empty after reset');
    assert(engine.totalSpawned === 0, 'totalSpawned must be 0');
    assert(engine.controllerPhase === 'NS_GREEN', 'controllerPhase must be NS_GREEN');
    assert(engine.getSignalState('north') === 'green', 'North should be green');
    assert(engine.getSignalState('east') === 'red', 'East should be red');
  });

  // 14. Vehicles can repeatedly stop and restart across multiple signal cycles
  test('Vehicles repeatedly stop and restart across multiple consecutive cycles', () => {
    const engine = new TrafficEngine();
    engine.reset();
    engine.setMode('fixed');

    const v = engine.spawnVehicle('north', 'straight', 'car')!;
    const stopDist = engine.stopLineDistance(v);
    v.distance = stopDist - 30;
    v.speed = 10;

    // Cycle 1: North is green -> vehicle proceeds
    step(engine, 2.0);
    assert(v.speed > 5, 'Vehicle should move during initial green');

    // Cycle 2: Switch to red
    engine.controllerPhase = 'EW_GREEN';
    engine.phaseTimer = 0;
    // Respawn a new car on North approaching red
    const v2 = engine.spawnVehicle('north', 'straight', 'car')!;
    v2.distance = stopDist - 25;
    v2.speed = 10;

    step(engine, 5.0);
    assert(v2.speed < 0.2, 'Vehicle 2 must stop at red light');
    assert(v2.distance <= stopDist, 'Vehicle 2 must remain behind stop line');

    // Cycle 3: Switch back to NS green
    engine.controllerPhase = 'NS_GREEN';
    engine.phaseTimer = 0;
    engine.update(FIXED_DT);

    step(engine, 3.0);
    assert(v2.speed > 3.0, 'Vehicle 2 must restart and accelerate when light turns green again');
    assert(v2.distance > stopDist, 'Vehicle 2 crosses intersection');
  });

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
