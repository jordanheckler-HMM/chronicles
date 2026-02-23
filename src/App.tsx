/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './GameContext';
import HomeScreen from './screens/HomeScreen';
import WorldPickerScreen from './screens/WorldPickerScreen';
import CharacterCreationScreen from './screens/CharacterCreationScreen';
import MainGameScreen from './screens/MainGameScreen';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/world" element={<WorldPickerScreen />} />
          <Route path="/character" element={<CharacterCreationScreen />} />
          <Route path="/game" element={<MainGameScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}
