/**
 * voiceEffectsProcessor.js
 * Procesador de Efectos Vocales y Modulación en Tiempo Real (Web Audio API DSP)
 * Permite transformar la voz de los participantes en vivo para grabaciones y streaming.
 */

export const VOICE_EFFECTS = [
  { id: 'normal', name: 'Voz Natural', icon: 'Mic', desc: 'Sin modulación · Sonido original de estudio', color: '#10b981' },
  { id: 'radio', name: 'Locutor Radio FM', icon: 'Radio', desc: 'Compresión broadcast cálida + presencia vocal', color: '#f97316' },
  { id: 'stadium', name: 'Estadio / Auditorio', icon: 'Tv', desc: 'Reverberación espacial expansiva de graderías', color: '#3b82f6' },
  { id: 'echo', name: 'Eco / Delay de Cabina', icon: 'AudioLines', desc: 'Ecos rítmicos espaciados con feedback', color: '#8b5cf6' },
  { id: 'martian', name: 'Marciano / Alien Robot', icon: 'Sparkles', desc: 'Modulación en anillo cibernética y metálica', color: '#06b6d4' },
  { id: 'telephone', name: 'Llamada Telefónica', icon: 'Smartphone', desc: 'Filtro banda 400Hz-3.4kHz estilo celular', color: '#eab308' },
  { id: 'monster', name: 'Voz Grave / Monstruo', icon: 'Sliders', desc: 'Bajos profundos y textura oscura de cine', color: '#ef4444' },
  { id: 'chipmunk', name: 'Ardilla / Agudo Cómico', icon: 'Music', desc: 'Realce hiperagudo estilo caricatura', color: '#ec4899' },
];

/**
 * Crea una cadena de procesamiento Web Audio DSP para un efecto vocal determinado
 * @param {AudioContext} ctx 
 * @param {AudioNode} sourceNode 
 * @param {AudioNode} destNode 
 * @param {string} effectId 
 * @returns {Array<AudioNode>} Lista de nodos para desconexión limpia
 */
export function applyVoiceEffectChain(ctx, sourceNode, destNode, effectId = 'normal') {
  const activeNodes = [];

  if (effectId === 'normal' || !effectId) {
    sourceNode.connect(destNode);
    return activeNodes;
  }

  try {
    if (effectId === 'radio') {
      // 1. Filtro corte de graves molestos (80Hz)
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(85, ctx.currentTime);

      // 2. Realce de cuerpo vocal (240Hz, +3.5dB)
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = 'peaking';
      eqLow.frequency.setValueAtTime(240, ctx.currentTime);
      eqLow.gain.setValueAtTime(3.5, ctx.currentTime);
      eqLow.Q.setValueAtTime(1.2, ctx.currentTime);

      // 3. Brillo de aire y presencia (3.6kHz, +4.5dB)
      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = 'peaking';
      eqHigh.frequency.setValueAtTime(3600, ctx.currentTime);
      eqHigh.gain.setValueAtTime(4.5, ctx.currentTime);
      eqHigh.Q.setValueAtTime(1.0, ctx.currentTime);

      // 4. Compresor Broadcast potente
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, ctx.currentTime);
      comp.knee.setValueAtTime(6, ctx.currentTime);
      comp.ratio.setValueAtTime(5, ctx.currentTime);
      comp.attack.setValueAtTime(0.003, ctx.currentTime);
      comp.release.setValueAtTime(0.06, ctx.currentTime);

      sourceNode.connect(hp);
      hp.connect(eqLow);
      eqLow.connect(eqHigh);
      eqHigh.connect(comp);
      comp.connect(destNode);

      activeNodes.push(hp, eqLow, eqHigh, comp);

    } else if (effectId === 'stadium') {
      // Doble delay en paralelo para simular reflexiones masivas de estadio
      const dryGain = ctx.createGain();
      dryGain.gain.setValueAtTime(0.7, ctx.currentTime);

      const wetGain = ctx.createGain();
      wetGain.gain.setValueAtTime(0.55, ctx.currentTime);

      const delay1 = ctx.createDelay();
      delay1.delayTime.setValueAtTime(0.38, ctx.currentTime);

      const delay2 = ctx.createDelay();
      delay2.delayTime.setValueAtTime(0.56, ctx.currentTime);

      const feedback = ctx.createGain();
      feedback.gain.setValueAtTime(0.42, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, ctx.currentTime);

      sourceNode.connect(dryGain);
      dryGain.connect(destNode);

      sourceNode.connect(delay1);
      delay1.connect(filter);
      filter.connect(delay2);
      delay2.connect(feedback);
      feedback.connect(delay1);

      filter.connect(wetGain);
      delay2.connect(wetGain);
      wetGain.connect(destNode);

      activeNodes.push(dryGain, wetGain, delay1, delay2, feedback, filter);

    } else if (effectId === 'echo') {
      // Eco rítmico espaciado
      const dryGain = ctx.createGain();
      dryGain.gain.setValueAtTime(0.85, ctx.currentTime);

      const wetGain = ctx.createGain();
      wetGain.gain.setValueAtTime(0.5, ctx.currentTime);

      const delay = ctx.createDelay();
      delay.delayTime.setValueAtTime(0.24, ctx.currentTime);

      const feedback = ctx.createGain();
      feedback.gain.setValueAtTime(0.45, ctx.currentTime);

      const damping = ctx.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.setValueAtTime(4500, ctx.currentTime);

      sourceNode.connect(dryGain);
      dryGain.connect(destNode);

      sourceNode.connect(delay);
      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);

      damping.connect(wetGain);
      wetGain.connect(destNode);

      activeNodes.push(dryGain, wetGain, delay, feedback, damping);

    } else if (effectId === 'martian') {
      // Modulación en Anillo (Ring Modulator) con oscilador senoidal
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(72, ctx.currentTime); // Frecuencia metálica marciana

      const ringGain = ctx.createGain();
      ringGain.gain.setValueAtTime(0.0, ctx.currentTime);

      const metallicFilter = ctx.createBiquadFilter();
      metallicFilter.type = 'peaking';
      metallicFilter.frequency.setValueAtTime(1400, ctx.currentTime);
      metallicFilter.Q.setValueAtTime(3.5, ctx.currentTime);
      metallicFilter.gain.setValueAtTime(6, ctx.currentTime);

      osc.connect(ringGain.gain);
      sourceNode.connect(ringGain);
      ringGain.connect(metallicFilter);
      metallicFilter.connect(destNode);

      try { osc.start(); } catch (e) {}

      activeNodes.push(osc, ringGain, metallicFilter);

    } else if (effectId === 'telephone') {
      // Paso banda estricto y saturación
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(420, ctx.currentTime);
      hp.Q.setValueAtTime(1.4, ctx.currentTime);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3300, ctx.currentTime);
      lp.Q.setValueAtTime(1.4, ctx.currentTime);

      // Saturador sutil tipo micrófono de carbón
      const shaper = ctx.createWaveShaper();
      const n = 512;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
      }
      shaper.curve = curve;

      sourceNode.connect(hp);
      hp.connect(lp);
      lp.connect(shaper);
      shaper.connect(destNode);

      activeNodes.push(hp, lp, shaper);

    } else if (effectId === 'monster') {
      // Efecto Voz Grave / Monstruo: Textura oscura, sub-graves profundos y saturación cinematográfica
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(850, ctx.currentTime);
      lp.Q.setValueAtTime(1.8, ctx.currentTime);

      const subBass = ctx.createBiquadFilter();
      subBass.type = 'lowshelf';
      subBass.frequency.setValueAtTime(120, ctx.currentTime);
      subBass.gain.setValueAtTime(14, ctx.currentTime);

      const growlShaper = ctx.createWaveShaper();
      const n = 512;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = Math.tanh(2.2 * x);
      }
      growlShaper.curve = curve;

      sourceNode.connect(lp);
      lp.connect(subBass);
      subBass.connect(growlShaper);
      growlShaper.connect(destNode);

      activeNodes.push(lp, subBass, growlShaper);

    } else if (effectId === 'chipmunk') {
      // Efecto Ardilla / Agudo Cómico: Modulación vocal caricatura con realce hiperagudo y formante nasal
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(900, ctx.currentTime);
      hp.Q.setValueAtTime(2.0, ctx.currentTime);

      const formant = ctx.createBiquadFilter();
      formant.type = 'peaking';
      formant.frequency.setValueAtTime(2800, ctx.currentTime);
      formant.gain.setValueAtTime(12, ctx.currentTime);
      formant.Q.setValueAtTime(3.0, ctx.currentTime);

      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.setValueAtTime(4200, ctx.currentTime);
      treble.gain.setValueAtTime(10, ctx.currentTime);

      // Modulador de timbre agudo animado
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, ctx.currentTime);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(0.35, ctx.currentTime);

      const mixGain = ctx.createGain();
      mixGain.gain.setValueAtTime(1.1, ctx.currentTime);

      osc.connect(modGain.gain);
      sourceNode.connect(hp);
      hp.connect(formant);
      formant.connect(treble);
      treble.connect(mixGain);
      mixGain.connect(destNode);

      try { osc.start(); } catch (e) {}

      activeNodes.push(hp, formant, treble, osc, modGain, mixGain);
    }
  } catch (err) {
    console.warn('[voiceEffectsProcessor] Error al montar cadena DSP:', err);
    try { sourceNode.connect(destNode); } catch (e) {}
  }

  return activeNodes;
}
