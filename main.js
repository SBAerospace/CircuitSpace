document.addEventListener('DOMContentLoaded', () => {

    const COMPONENT_DEFINITIONS = {
        battery_9v: {
            name: "9V Battery",
            width: 50,
            height: 80,
            properties: { label: "9V Battery", voltage: 9, capacity: 500 },
            pins: [
                { id: 'pos', label: '+', x: 10, y: 10, type: 'POWER' },
                { id: 'neg', label: '-', x: 40, y: 10, type: 'GROUND' },
            ]
        },
        lipo_2s: {
            name: "2S LiPo Battery",
            width: 60,
            height: 100,
            properties: { label: "2S LiPo", voltage: 7.4, capacity: 1000 },
            pins: [
                { id: 'pos', label: '+', x: 15, y: 10, type: 'POWER' },
                { id: 'neg', label: '-', x: 45, y: 10, type: 'GROUND' },
            ]
        },
        power_switch: {
            name: "Power Switch",
            width: 60,
            height: 40,
            properties: { label: "Main Switch" },
            pins: [
                { id: 'in', label: 'IN', x: 10, y: 20, type: 'ANY' },
                { id: 'out', label: 'OUT', x: 50, y: 20, type: 'ANY' },
            ]
        },
        altimeter: {
            name: "Flight Computer",
            width: 120,
            height: 80,
            properties: { label: "Altimeter", operatingVoltage: 5 },
            pins: [
                { id: 'pwr_in', label: 'PWR', x: 10, y: 20, type: 'POWER' },
                { id: 'gnd', label: 'GND', x: 10, y: 60, type: 'GROUND' },
                { id: 'apogee', label: 'APG', x: 110, y: 20, type: 'SIGNAL' },
                { id: 'main', label: 'MAIN', x: 110, y: 60, type: 'SIGNAL' },
            ]
        },
        servo: {
            name: "Servo Motor",
            width: 80,
            height: 50,
            properties: { label: "Airbrake Servo", operatingVoltage: 5 },
            pins: [
                { id: 'pwr', label: 'PWR', x: 10, y: 25, type: 'POWER' },
                { id: 'gnd', label: 'GND', x: 40, y: 25, type: 'GROUND' },
                { id: 'sig', label: 'SIG', x: 70, y: 25, type: 'SIGNAL' },
            ]
        },
        terminal_block: {
            name: "Terminal Block",
            width: 100,
            height: 40,
            properties: { label: "Power Bus" },
            pins: [
                { id: 't1', label: '1', x: 15, y: 20, type: 'ANY' },
                { id: 't2', label: '2', x: 40, y: 20, type: 'ANY' },
                { id: 't3', label: '3', x: 65, y: 20, type: 'ANY' },
                { id: 't4', label: '4', x: 90, y: 20, type: 'ANY' },
            ]
        }
    };

    const appState = {
        components: [],
        wires: [],
        nextId: 0,
        selectedComponentId: null,
        wiringState: {
            active: false,
            sourcePin: null,
            tempLine: null
        },
        view: {
            scale: 1,
            panX: 0,
            panY: 0
        }
    };

    const componentsList = document.getElementById('components-list');
    const canvas = document.getElementById('drawing-canvas');
    const inspectorContent = document.getElementById('inspector-content');
    const validationList = document.getElementById('validation-list');
    const bomModal = document.getElementById('bom-modal');
    const bomTableBody = bomModal.querySelector('tbody');
    const closeModalBtn = bomModal.querySelector('.close-button');

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomPercentageDisplay = document.getElementById('zoom-percentage');

    function render() {
        canvas.innerHTML = '';

        const transformGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        transformGroup.setAttribute('transform', `scale(${appState.view.scale}) translate(${appState.view.panX}, ${appState.view.panY})`);
        canvas.appendChild(transformGroup);

        appState.wires.forEach(wire => {
            const sourceComp = findComponent(wire.source.componentId);
            const targetComp = findComponent(wire.target.componentId);
            if (!sourceComp || !targetComp) return;

            const sourcePin = findPin(sourceComp, wire.source.pinId);
            const targetPin = findPin(targetComp, wire.target.pinId);
            if (!sourcePin || !targetPin) return;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', sourceComp.x + sourcePin.x);
            line.setAttribute('y1', sourceComp.y + sourcePin.y);
            line.setAttribute('x2', targetComp.x + targetPin.x);
            line.setAttribute('y2', targetComp.y + targetPin.y);
            
            const wireType = sourcePin.type === 'ANY' ? targetPin.type : sourcePin.type;
            line.setAttribute('class', `wire ${wireType}`);
            transformGroup.appendChild(line);
        });

        appState.components.forEach(comp => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'draggable-group');
            group.setAttribute('transform', `translate(${comp.x}, ${comp.y})`);
            group.dataset.id = comp.id;

            const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            body.setAttribute('width', comp.width);
            body.setAttribute('height', comp.height);
            body.setAttribute('rx', 5);
            body.setAttribute('class', 'component-body');
            if(comp.id === appState.selectedComponentId) {
                body.classList.add('selected');
            }
            group.appendChild(body);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', comp.width / 2);
            label.setAttribute('y', -8);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('class', 'component-label');
            label.textContent = comp.properties.label;
            group.appendChild(label);
            
            comp.pins.forEach(pin => {
                const pinCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                pinCircle.setAttribute('cx', pin.x);
                pinCircle.setAttribute('cy', pin.y);
                pinCircle.setAttribute('r', 5);
                pinCircle.setAttribute('class', 'pin');
                pinCircle.dataset.componentId = comp.id;
                pinCircle.dataset.pinId = pin.id;
                group.appendChild(pinCircle);

                const pinLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                pinLabel.setAttribute('x', pin.x);
                pinLabel.setAttribute('y', pin.y - 8);
                pinLabel.setAttribute('text-anchor', 'middle');
                pinLabel.setAttribute('class', 'pin-label');
                pinLabel.textContent = pin.label;
                group.appendChild(pinLabel);
            });
            transformGroup.appendChild(group);
        });
    }

    function addComponent(type, x, y) {
        const definition = COMPONENT_DEFINITIONS[type];
        if (!definition) return;

        const newComponent = {
            id: appState.nextId++,
            type: type,
            x: x,
            y: y,
            width: definition.width,
            height: definition.height,
            properties: JSON.parse(JSON.stringify(definition.properties)),
            pins: JSON.parse(JSON.stringify(definition.pins))
        };
        appState.components.push(newComponent);
        selectComponent(newComponent.id);
    }
    
    function removeComponent(componentId) {
        appState.wires = appState.wires.filter(w => 
            w.source.componentId !== componentId && w.target.componentId !== componentId
        );
        appState.components = appState.components.filter(c => c.id !== componentId);

        if (appState.selectedComponentId === componentId) {
            appState.selectedComponentId = null;
            updateInspector();
        }
        
        runValidation();
        render();
    }

    function selectComponent(id) {
        appState.selectedComponentId = id;
        updateInspector();
        render();
    }

    function updateInspector() {
        const component = findComponent(appState.selectedComponentId);
        if (!component) {
            inspectorContent.innerHTML = '<p class="placeholder-text">Select a component to see its properties.</p>';
            return;
        }

        let html = '';
        for (const key in component.properties) {
            const value = component.properties[key];
            html += `
                <div class="property-item">
                    <label for="prop-${key}">${key.charAt(0).toUpperCase() + key.slice(1)}</label>
                    <input type="text" id="prop-${key}" data-key="${key}" value="${value}">
                </div>
            `;
        }
        
        html += `<button id="delete-component-btn" class="delete-button">Delete Component</button>`;
        inspectorContent.innerHTML = html;

        inspectorContent.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const key = e.target.dataset.key;
                const value = e.target.value;
                const componentToUpdate = findComponent(appState.selectedComponentId);
                componentToUpdate.properties[key] = isNaN(parseFloat(value)) ? value : parseFloat(value);
                if (key === 'label') {
                    render();
                }
                runValidation();
            });
        });
        
        document.getElementById('delete-component-btn').addEventListener('click', () => {
            if(confirm('Are you sure you want to delete this component?')) {
                 removeComponent(appState.selectedComponentId);
            }
        });
    }
    
    function runValidation() {
        validationList.innerHTML = '';
        const errors = [];
        
        appState.components.forEach(comp => {
            comp.pins.forEach(pin => {
                if (pin.type !== 'ANY' && !isPinConnected(comp.id, pin.id)) {
                    errors.push({
                        level: 'warning',
                        message: `${comp.properties.label} (${comp.type}) has an unconnected ${pin.type} pin (${pin.label}).`
                    });
                }
            });
        });
        
        const powerSources = appState.components.filter(c => c.type.includes('battery'));
        powerSources.forEach(source => {
            const positivePin = source.pins.find(p => p.type === 'POWER');
            const negativePin = source.pins.find(p => p.type === 'GROUND');
            if (positivePin && negativePin) {
                 if (isPath(source.id, positivePin.id, source.id, negativePin.id, [])) {
                     errors.push({
                        level: 'error',
                        message: `SHORT CIRCUIT DETECTED on ${source.properties.label}!`
                    });
                 }
            }
        });
        
        appState.wires.forEach(wire => {
            const sourceComp = findComponent(wire.source.componentId);
            const sourcePin = findPin(sourceComp, wire.source.pinId);
            const targetComp = findComponent(wire.target.componentId);
            const targetPin = findPin(targetComp, wire.target.pinId);

            if (sourcePin.type === 'POWER' && 'operatingVoltage' in targetComp.properties) {
                const sourceVoltage = sourceComp.properties.voltage;
                const targetVoltage = targetComp.properties.operatingVoltage;
                if (sourceVoltage && targetVoltage && Math.abs(sourceVoltage - targetVoltage) > 1) {
                    errors.push({
                        level: 'error',
                        message: `${targetComp.properties.label} expects ~${targetVoltage}V but is connected to ${sourceVoltage}V from ${sourceComp.properties.label}.`
                    });
                }
            }
        });

        if(errors.length === 0) {
            validationList.innerHTML = '<li class="valid">System OK</li>';
        } else {
            errors.forEach(err => {
                const li = document.createElement('li');
                li.className = err.level;
                li.textContent = err.message;
                validationList.appendChild(li);
            });
        }
    }
    
    function isPath(sourceCompId, sourcePinId, targetCompId, targetPinId, visited) {
        const connections = findConnections(sourceCompId, sourcePinId);
        for(const conn of connections) {
            if (conn.componentId === targetCompId && conn.pinId === targetPinId) {
                return true;
            }
            
            const visitKey = `${conn.componentId}-${conn.pinId}`;
            if (visited.includes(visitKey)) continue;
            visited.push(visitKey);
            
            const connComp = findComponent(conn.componentId);
            if (connComp.type === 'terminal_block' || connComp.type === 'power_switch') {
                for (const otherPin of connComp.pins) {
                    if (otherPin.id !== conn.pinId) {
                        if (isPath(conn.componentId, otherPin.id, targetCompId, targetPinId, [...visited])) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    for (const type in COMPONENT_DEFINITIONS) {
        const def = COMPONENT_DEFINITIONS[type];
        const item = document.createElement('div');
        item.className = 'component-item';
        item.textContent = def.name;
        item.draggable = true;
        item.dataset.type = type;
        componentsList.appendChild(item);
    }
    
    componentsList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('component-item')) {
            e.dataTransfer.setData('text/plain', e.target.dataset.type);
        }
    });

    function getMousePosition(evt) {
        const CTM = canvas.getScreenCTM();
        return {
          x: (evt.clientX - CTM.e) / appState.view.scale - appState.view.panX,
          y: (evt.clientY - CTM.f) / appState.view.scale - appState.view.panY
        };
    }

    canvas.addEventListener('dragover', (e) => e.preventDefault());

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain');
        const pos = getMousePosition(e);
        addComponent(type, pos.x, pos.y);
    });

    let dragInfo = null;
    let panInfo = null;

    canvas.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('pin')) {
            appState.wiringState.active = true;
            const componentId = parseInt(e.target.dataset.componentId);
            const pinId = e.target.dataset.pinId;
            appState.wiringState.sourcePin = { componentId, pinId };

            const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tempLine.setAttribute('class', 'wire temp');
            
            appState.wiringState.tempLine = tempLine;
            
            e.stopPropagation(); 
            return;
        }

        const group = e.target.closest('.draggable-group');
        if (group) {
            const id = parseInt(group.dataset.id);
            selectComponent(id);
            const pos = getMousePosition(e);
            
            dragInfo = {
                component: findComponent(id),
                offsetX: pos.x - findComponent(id).x,
                offsetY: pos.y - findComponent(id).y,
            };
        } else {
            selectComponent(null);
            panInfo = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                initialPanX: appState.view.panX,
                initialPanY: appState.view.panY
            };
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const pos = getMousePosition(e);
        
        if (appState.wiringState.active) {
            const sourceComp = findComponent(appState.wiringState.sourcePin.componentId);
            const sourcePinDef = findPin(sourceComp, appState.wiringState.sourcePin.pinId);

            appState.wiringState.tempLine.setAttribute('x1', sourceComp.x + sourcePinDef.x);
            appState.wiringState.tempLine.setAttribute('y1', sourceComp.y + sourcePinDef.y);
            appState.wiringState.tempLine.setAttribute('x2', pos.x);
            appState.wiringState.tempLine.setAttribute('y2', pos.y);
           
            const transformGroup = canvas.querySelector('g');
            if (transformGroup && !appState.wiringState.tempLine.parentElement) {
                 transformGroup.appendChild(appState.wiringState.tempLine);
            }
            return;
        }

        if (dragInfo) {
            dragInfo.component.x = pos.x - dragInfo.offsetX;
            dragInfo.component.y = pos.y - dragInfo.offsetY;
            render();
        } else if (panInfo && panInfo.active) {
            const dx = (e.clientX - panInfo.startX) / appState.view.scale;
            const dy = (e.clientY - panInfo.startY) / appState.view.scale;
            appState.view.panX = panInfo.initialPanX + dx;
            appState.view.panY = panInfo.initialPanY + dy;
            render();
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (appState.wiringState.active) {
             if (appState.wiringState.tempLine.parentElement) {
                appState.wiringState.tempLine.remove();
            }

            if (e.target.classList.contains('pin')) {
                const targetComponentId = parseInt(e.target.dataset.componentId);
                const targetPinId = e.target.dataset.pinId;
                
                if (appState.wiringState.sourcePin.componentId !== targetComponentId) {
                     appState.wires.push({
                        source: appState.wiringState.sourcePin,
                        target: { componentId: targetComponentId, pinId: targetPinId }
                    });
                    runValidation();
                    render();
                }
            }
            appState.wiringState.active = false;
            appState.wiringState.sourcePin = null;
            appState.wiringState.tempLine = null;
        }

        dragInfo = null;
        if (panInfo) {
            panInfo.active = false;
        }
    });
    
    zoomInBtn.addEventListener('click', () => zoom(1.2));
    zoomOutBtn.addEventListener('click', () => zoom(1 / 1.2));

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoom(zoomFactor, e.clientX, e.clientY);
    });

    function zoom(factor) {
        const newScale = appState.view.scale * factor;
        
        // Apply zoom limits
        if (newScale < 0.2) {
            appState.view.scale = 0.2;
        } else if (newScale > 5) {
            appState.view.scale = 5;
        } else {
            appState.view.scale = newScale;
        }

        updateZoomDisplay();
        render();
    }

    function updateZoomDisplay() {
        const percentage = Math.round(appState.view.scale * 100);
        zoomPercentageDisplay.textContent = `${percentage}%`;
    }


    document.getElementById('generate-bom-btn').addEventListener('click', () => {
        bomTableBody.innerHTML = '';
        const componentCounts = {};

        appState.components.forEach(comp => {
            const key = `${comp.type}-${comp.properties.label}`;
            if (!componentCounts[key]) {
                componentCounts[key] = {
                    name: COMPONENT_DEFINITIONS[comp.type].name,
                    label: comp.properties.label,
                    quantity: 0
                };
            }
            componentCounts[key].quantity++;
        });

        for (const key in componentCounts) {
            const item = componentCounts[key];
            const row = bomTableBody.insertRow();
            row.insertCell(0).textContent = item.name;
            row.insertCell(1).textContent = item.label;
            row.insertCell(2).textContent = item.quantity;
        }
        
        bomModal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => {
        bomModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == bomModal) {
            bomModal.style.display = 'none';
        }
    });

    document.getElementById('export-svg-btn').addEventListener('click', () => {
        const selected = canvas.querySelector('.selected');
        if (selected) selected.classList.remove('selected');

        const svgData = new XMLSerializer().serializeToString(canvas);
        
        if (selected) selected.classList.add('selected');
        
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'rocket-circuit-plan.svg';
        link.click();
        URL.revokeObjectURL(url);
    });

    const findComponent = (id) => appState.components.find(c => c.id === id);
    const findPin = (component, pinId) => component.pins.find(p => p.id === pinId);
    const isPinConnected = (componentId, pinId) => appState.wires.some(w =>
        (w.source.componentId === componentId && w.source.pinId === pinId) ||
        (w.target.componentId === componentId && w.target.pinId === pinId)
    );
    const findConnections = (componentId, pinId) => {
        const connections = [];
        appState.wires.forEach(w => {
            if(w.source.componentId === componentId && w.source.pinId === pinId) {
                connections.push(w.target);
            }
            if(w.target.componentId === componentId && w.target.pinId === pinId) {
                connections.push(w.source);
            }
        });
        return connections;
    };
    
    // Initial setup calls
    updateZoomDisplay();
    render();
    runValidation();

});