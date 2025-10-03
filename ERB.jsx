import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Play, Pause, RotateCcw, FastForward, Rewind } from 'lucide-react';

// Hulplijst met Nederlandse veldnamen en eenheden
const motionFields = [
  { id: 'x0', label: 'Startpositie (x₀)', unit: 'm', setter: 'setX0', defaultValue: 0 },
  { id: 'v0', label: 'Startsnelheid (v₀)', unit: 'm/s', setter: 'setV0', defaultValue: 5 },
  { id: 'a', label: 'Versnelling (a)', unit: 'm/s²', setter: 'setA', defaultValue: 1 },
  { id: 't0', label: 'Start Tijd (t₀)', unit: 's', setter: 'setT0', defaultValue: 0 },
];

// Functie om de beweging te berekenen op tijdstip t
const calculateMotion = (t, x0, v0, t0, a) => {
  // Bepaal de verstreken tijd sinds t0
  const dt = t - t0;
  
  // Als de simulatie tijd t kleiner is dan de start tijd t0, is de auto nog niet begonnen
  if (dt < 0) {
    return { x: x0, v: v0, isStarted: false };
  }

  // Formules voor eenparig versnelde beweging:
  // Positie: x(t) = x₀ + v₀(t - t₀) + ½a(t - t₀)²
  // Snelheid: v(t) = v₀ + a(t - t₀)
  const x = x0 + v0 * dt + 0.5 * a * dt * dt;
  const v = v0 + a * dt;
  
  return { x, v, isStarted: true };
};

const InputControl = ({ label, unit, value, onChange }) => (
  <div className="flex flex-col p-2 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm">
    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{label}</label>
    <div className="flex items-center">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-l-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        step="0.1"
      />
      <span className="p-2 text-sm bg-gray-300 dark:bg-gray-600 rounded-r-md font-medium text-gray-800 dark:text-gray-200">{unit}</span>
    </div>
  </div>
);

// Hoofdcomponent
export default function App() {
  // Bewegingsparameters
  const [x0, setX0] = useState(motionFields.find(f => f.id === 'x0').defaultValue);
  const [v0, setV0] = useState(motionFields.find(f => f.id === 'v0').defaultValue);
  const [a, setA] = useState(motionFields.find(f => f.id === 'a').defaultValue);
  const [t0, setT0] = useState(motionFields.find(f => f.id === 't0').defaultValue);
  
  // Simulatie status
  const [time, setTime] = useState(0); // Huidige Tijd (s)
  const [isRunning, setIsRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // Snelheid van de simulatie
  const maxDuration = 10; // Maximale simulatie duur in seconden

  // Handlers voor de input velden
  const setters = useMemo(() => ({ setX0, setV0, setA, setT0 }), []);
  
  const handleInputChange = (setterName, value) => {
    // Stop de simulatie bij het aanpassen van parameters
    setIsRunning(false);
    setTime(0);
    if (setters[setterName]) {
      setters[setterName](value);
    }
  };

  // --- ANIMATIE LOOP (Gebruikt setInterval voor stabiele tijdsstappen) ---
  useEffect(() => {
    let intervalId;
    const intervalTime = 50; // 50ms interval = 20 FPS

    if (isRunning && time < maxDuration) {
      intervalId = setInterval(() => {
        setTime(prevTime => {
          // Berekent de volgende tijdstap met de ingestelde multiplier
          const timeStep = (intervalTime / 1000) * speedMultiplier;
          const newTime = prevTime + timeStep;
          
          if (newTime >= maxDuration) {
            setIsRunning(false);
            return maxDuration;
          }
          return newTime;
        });
      }, intervalTime);
    } else if (time >= maxDuration) {
      setIsRunning(false);
    }

    return () => clearInterval(intervalId);
  }, [isRunning, time, maxDuration, speedMultiplier]);

  // Functie voor reset
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTime(0);
  }, []);
  
  // Functie voor de snelheid multiplier
  const toggleSpeed = useCallback(() => {
    setSpeedMultiplier(prev => prev === 1 ? 2 : 1);
  }, []);


  // --- BEWEGINGSGEGEVENS BEREKENEN ---
  const currentMotion = calculateMotion(time, x0, v0, t0, a);
  const { x: currentX, v: currentV } = currentMotion;

  // Genereer de data voor de grafieken tot de huidige tijd
  const graphData = useMemo(() => {
    const data = [];
    const step = 0.2; // Data punt elke 0.2s

    for (let t = 0; t <= time; t += step) {
      const t_current = Math.min(t, time);
      const motion = calculateMotion(t_current, x0, v0, t0, a);
      
      data.push({
        t: parseFloat(t_current.toFixed(2)), // Tijd (s)
        x: parseFloat(motion.x.toFixed(2)), // Positie (m)
        v: parseFloat(motion.v.toFixed(2)), // Snelheid (m/s)
      });
      
      if (t_current === time) break;
    }
    
    // Voeg het exacte eindpunt toe als het nog niet is opgenomen
    if (data.length === 0 || data[data.length - 1].t !== parseFloat(time.toFixed(2))) {
      data.push({
          t: parseFloat(time.toFixed(2)),
          x: parseFloat(currentX.toFixed(2)),
          v: parseFloat(currentV.toFixed(2)),
      });
    }

    return data;
  }, [time, x0, v0, t0, a, currentX, currentV]);

  // --- AUTO VISUALISATIE BEREKENING ---
  
  // Bepaal de maximale x-positie om de schaal van de baan te bepalen
  const maxX_data = graphData.reduce((max, point) => Math.max(max, point.x), 0);
  // Gebruik een dynamische maximale positie, maar minstens 20m, plus 10m buffer
  const trackMaxX = Math.max(30, maxX_data + 10); 
  
  // Bepaal de positie van de auto in procenten (van 0% tot 100% van de baan)
  const carPositionPercent = (currentX / trackMaxX) * 100;
  // Clamp de positie om te voorkomen dat de auto buiten beeld schiet (5% is een kleine marge)
  const clampedCarPosition = Math.min(95, Math.max(5, carPositionPercent)); 

  // Mapping object voor de huidige staatswaarden, ter vervanging van eval()
  const currentValues = useMemo(() => ({ x0, v0, a, t0 }), [x0, v0, a, t0]);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen dark:bg-gray-900 font-sans transition-colors duration-300">
      <h1 className="text-3xl font-extrabold text-center mb-6 text-gray-900 dark:text-white">
        Natuurkunde Simulator: Auto in Beweging
      </h1>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
        Pas de startcondities en versnelling aan om de beweging van de auto te observeren.
      </p>

      {/* 1. CONTROLS PANEEL */}
      <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Bewegingsparameters
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {motionFields.map(field => (
            <InputControl
              key={field.id}
              label={field.label}
              unit={field.unit}
              value={currentValues[field.id]} // Vaste de 'eval' foutmelding op
              onChange={(val) => handleInputChange(field.setter, val)}
            />
          ))}
        </div>
        
        {/* Simulatie Controls */}
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => setIsRunning(prev => !prev)}
            disabled={time >= maxDuration}
            className={`flex items-center px-6 py-3 rounded-full font-bold text-white shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 ${isRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {isRunning ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
            {isRunning ? 'Pauze' : time > 0 ? 'Hervatten' : 'Start'}
          </button>
          
          <button
            onClick={handleReset}
            className="flex items-center px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold shadow-lg transition-transform transform hover:scale-105"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Reset
          </button>
           <button
            onClick={toggleSpeed}
            className={`flex items-center px-6 py-3 rounded-full font-bold shadow-lg transition-transform transform hover:scale-105 ${speedMultiplier === 1 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'} text-white`}
          >
            {speedMultiplier === 1 ? <FastForward className="w-5 h-5 mr-2" /> : <Rewind className="w-5 h-5 mr-2" />}
            {speedMultiplier === 1 ? '2x Versnellen' : '1x Normaal'}
          </button>
        </div>
      </div>

      {/* 2. AUTO ANIMATIE */}
      <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          Simulatie ({time.toFixed(2)}s / {maxDuration}s)
        </h2>
        
        {/* Display Current State */}
        <div className="mb-4 text-center text-lg font-mono">
            <span className="text-blue-600 dark:text-blue-400 mr-4">Positie: x = {currentX.toFixed(2)} m</span>
            <span className="text-green-600 dark:text-green-400">Snelheid: v = {currentV.toFixed(2)} m/s</span>
            {currentMotion.isStarted === false && <span className="ml-4 text-red-500">(Wacht op Start Tijd t₀)</span>}
        </div>

        {/* De Baan */}
        <div className="relative w-full h-20 bg-gray-300 dark:bg-gray-700 rounded-lg overflow-hidden">
          {/* De Auto */}
          <div
            className="absolute h-8 w-12 bg-red-600 rounded-lg shadow-xl flex items-center justify-center transition-all duration-100 ease-linear"
            style={{ 
              bottom: '20px', // Boven de streep
              left: `${clampedCarPosition}%`, // Dynamische positie
              transform: 'translateX(-50%)', // Centreer de auto op de positie
            }}
          >
            {/* Auto voorruit (simpel) */}
            <div className="h-4 w-4 bg-white/70 rounded-sm"></div>
          </div>
          
          {/* De Baan Markering */}
          <div className="absolute bottom-0 w-full h-4 bg-gray-400 dark:bg-gray-600">
            {/* Startlijn */}
            <div 
                className="absolute top-0 h-4 w-0.5 bg-black" 
                style={{ left: `${(x0 / trackMaxX) * 100}%` }}
                title={`Startpositie: ${x0}m`}
            ></div>
            {/* Streepjes/Grid (eenvoudig) */}
            {[...Array(Math.floor(trackMaxX / 5)).keys()].map(i => (
                <div 
                    key={i}
                    className="absolute top-0 h-4 w-0.5 bg-gray-800 dark:bg-gray-200 opacity-50" 
                    style={{ left: `${((i + 1) * 5 / trackMaxX) * 100}%` }}
                ></div>
            ))}
          </div>
        </div>
         <p className="text-xs text-right text-gray-500 dark:text-gray-400 mt-1">
            Baanlengte (max. X-schaal): {trackMaxX.toFixed(2)} m
        </p>
      </div>

      {/* 3. GRAFIEKEN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Positie vs Tijd Grafiek */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
            Positie - Tijd Grafiek: x(t)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={graphData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-gray-600"/>
              <XAxis dataKey="t" label={{ value: 'Tijd t (s)', position: 'bottom', offset: 0, fill: '#374151' }} stroke="#6b7280" domain={[0, maxDuration]}/>
              <YAxis label={{ value: 'Positie x (m)', angle: -90, position: 'insideLeft', fill: '#374151' }} stroke="#6b7280"/>
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc', borderRadius: '4px' }}
                labelFormatter={(name) => `Tijd: ${name.toFixed(2)} s`}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line type="monotone" dataKey="x" name="Positie (m)" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Snelheid vs Tijd Grafiek */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
            Snelheid - Tijd Grafiek: v(t)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={graphData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-gray-600"/>
              <XAxis dataKey="t" label={{ value: 'Tijd t (s)', position: 'bottom', offset: 0, fill: '#374151' }} stroke="#6b7280" domain={[0, maxDuration]}/>
              <YAxis label={{ value: 'Snelheid v (m/s)', angle: -90, position: 'insideLeft', fill: '#374151' }} stroke="#6b7280"/>
              <Tooltip 
                 contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc', borderRadius: '4px' }}
                 labelFormatter={(name) => `Tijd: ${name.toFixed(2)} s`}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line type="monotone" dataKey="v" name="Snelheid (m/s)" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
    </div>
  );
}
