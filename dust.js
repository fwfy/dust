const canvas = document.getElementById("dust_canvas");
const ctx = canvas.getContext('2d');
let sim_settings = {
    width: 200,
    height: 200,
    zoom: 3,
    friction: 0.98
}

let cells = new Array(sim_settings.width).fill(0).map(() => new Array(sim_settings.height).fill(0));
let backrooms = new Array(sim_settings.width).fill(0).map(() => new Array(sim_settings.height).fill(0));
let particle_chooser = document.getElementById("particle_chooser");
let brush_size_slider = document.getElementById("brush_size");
let sim_state = {
    framecount: 0,
    mouse: {
        x: 0,
        y: 0,
        clicking: false
    },
    brush_size: brush_size_slider,
    current_place_type: "AIR"
}

function fatalError(msg) {
    alert(`A fatal error has occurred, and Dust is not able to continue.\n\nError details: ${msg}`);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


let mat_attrs = {
    "AIR": {
        gravity: false,
        draw: false,
        color: `255,0,0,255`,
        solid: false,
        default_physics: false
    },
    "STUFF": {
        gravity: true,
        draw: true,
        color: "0,255,0,255",
        solid: true,
        default_physics: true,
        physics_custom: e => {
            if(Math.random() < 0.05) {
                e.xv = (Math.random()*2)-1;
                e.yv = (Math.random()*2)-1;
            }
        }
    },
    "WATER": {
        gravity: true,
        draw: true,
        color: "0,0,255,128",
        solid: false,
        default_physics: true,
        friction: 0.999,
        physics_custom: e => {
            let onTopOfWater = cells[e.x][e.y+1]?.type=="WATER";
            e.xv += ((Math.random()*4)-2)/(onTopOfWater?1:10);
            e.yv = Math.min(1,onTopOfWater?e.yv:1);
            e.friction = onTopOfWater?1:0.95;
            // e.yv += ((Math.random()*2)-1)/5;
        }
    },
    "SPONGE": {
        gravity: true,
        draw: true,
        color: "255,200,0,255",
        solid: true,
        default_physics: true,
        physics_custom: e => {
            for(let x = -1; x < 1; x++) {
                for(let y = -1; y < 1; y++) {
                    if(cells?.[e.x+x]?.[e.y+y]?.type == "WATER") {
                        new Cell("AIR",20,e.x+x,e.y+y,0,0,0);
                    }
                }    
            }
        }
    },
    "WALL": {
        gravity: false,
        draw: true,
        color: "100,100,100,255",
        solid: true,
        default_physics: false,
        physics_custom: e => {
            e.xv = 0;
            e.yv = 0;
        }
    },
    "WARP": {
        gravity: false,
        draw: true,
        color: "50,50,50,255",
        solid: true,
        default_physics: false,
        physics_custom: e => {
            if(this.age > 100) return cells[e.x][e.y] = undefined;
            for(i=0;i<10;i++) swapParticles(e.x + getRandomInt(-1,1), e.y + getRandomInt(-1,1), e.x + getRandomInt(-1,1), e.y + getRandomInt(-1,1))
        }
    }
}


Object.keys(mat_attrs).forEach(e => {
    let opt = document.createElement("option");
    opt.value = e;
    opt.innerText = e;
    particle_chooser.appendChild(opt);
});

function swapParticles(x1,y1,x2,y2) {
    if(x1 < 0 || y1 < 0 || x1 > sim_settings.width-1 || y1 > sim_settings.height-1) return;
    if(x2 < 0 || y2 < 0 || x2 > sim_settings.width-1 || y2 > sim_settings.height-1) return;
    let part = cells[x1][y1];
    cells[x1][y1] = cells[x2][y2];
    cells[x2][y2] = part;
}

class Cell {
    constructor(type, temp=0, x=0, y=0, xv=0, yv=0, special) {
        if(x < 0 || y < 0 || x > sim_settings.width-1 || y > sim_settings.height-1) return;
        this.id = Math.random().toString(16).slice(2);
        this.type = type;
        this.temp = temp;
        this._x = x;
        this._y = y;
        this.xv = xv;
        this.yv = yv;
        this.special = special;
        this.age = 0;
        this.falling = false;
        this.material_attributes = mat_attrs[this.type];
        this.color = this.material_attributes.color;
        this.latestPhysicsUpdate = 0;
        cells[this._x][this._y] = this;
    }
    updatePosition(ox,oy,nx,ny) {
        try {
            if(ox == nx && oy == ny) return;
            if(cells[nx][ny].material_attributes.solid || cells[nx][ny].type == this.type) return (this.xv = this.yv = 0);
            if(!cells[nx][ny].material_attributes.solid) backrooms[nx][ny] = cells[nx][ny];
            cells[ox][oy] = null;
            new Cell("AIR",20,ox,oy,0,0,0);
            cells[nx][ny] = this;
        } catch(err) {
            return fatalError(`Uncaught exception when attempting to perform Cell.updatePosition (${ox}, ${oy} [${cells[ox]?.[oy]?.type}] -> ${nx} ${ny} [${cells[nx]?.[ny]?.type}])`);
        }
    }
    set x(v) {
        v = Math.round(v);
        if(this._x == v) return;
        if(v < 0 || v > sim_settings.width-1) return;
        this.updatePosition(this._x,this._y,v,this._y);
        this._x = v;
    }
    set y(v) {
        v = Math.round(v);
        if(this._y == v) return;
        if(v < 0 || v > sim_settings.height-1) return;
        this.updatePosition(this._x,this._y,this._x,v);
        this._y = v;
    }
    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
}

function forAllCells(callback) {
    for(x=0;x<sim_settings.width;x++) {
        for(y=0;y<sim_settings.height;y++) {
            callback(cells[x][y],x,y);
        }
    }
}

forAllCells((_, x, y) => {
    new Cell("AIR",20,x,y,0,0,0);
});

function blank() {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0,0,800,600);
}

function placeCell(cell_string,x,y) {
    let cell = parseCell(cell_string,x*y);
    cells[cell.cellPos] = cell;
    return cell;
}

function physics(cell,x,y) {
    if(typeof cell == "undefined") return fatalError(`Cell argument to function physics() was undefined! (${x},${y})`);
    if(cell.x != x) cell.x = x;
    if(cell.y != y) cell.y = y;
    if(cell.latestPhysicsUpdate == sim_state.framecount) return false;
    if(cell.material_attributes.default_physics) {
        if(cell.x < 0) cell.x = 0;
        if(cell.y < 0) cell.y = 0;
        if(cell.x > sim_settings.width) cell.x = sim_settings.width-2;
        if(cell.y > sim_settings.height) cell.y = sim_settings.height-2;
        cell.temp -= cell.temp/1000;
        // cell.falling = (!cells[cell.x][cell.y+1]?.solid && cell.y < sim_settings.height);
        if(cell.material_attributes.gravity) {
            cell.yv += 0.05;
        }
        cell.xv *= cell.friction || sim_settings.friction;
        cell.yv *= cell.friction || sim_settings.friction;
        cell.x += cell.xv;
        cell.y += cell.yv;
    }
    if(cell.material_attributes.physics_custom) cell.material_attributes.physics_custom(cell);
    if(cell.type == "AIR" && backrooms[x][y]) {
        cells[x][y] = backrooms[x][y];
        backrooms[x][y] = false;
    }
    cell.latestPhysicsUpdate = sim_state.framecount;
}

function physicsAll() {
    forAllCells(physics);
}

function draw(cell,x,y) {
    if(!cell.material_attributes.draw) return;
    ctx.fillStyle = `rgba(${cell.color})`;
    ctx.fillRect(x*sim_settings.zoom, y*sim_settings.zoom, sim_settings.zoom, sim_settings.zoom)
    cell.age++;
}

function drawAll() {
    forAllCells(draw);
}

function loop(once=false) {
    let startTime = Date.now();
    sim_state.framecount++;
    blank();
    let physStart = Date.now();
    physicsAll();
    let physEnd = Date.now();
    let drawStart = Date.now();
    if(sim_state.mouse.clicking) {
        for(let xo = -sim_state.brush_size; xo < sim_state.brush_size; xo++) {
            for(let yo = -sim_state.brush_size; yo < sim_state.brush_size; yo++) {
                if(!(sim_state.mouse.x+xo < 0 || sim_state.mouse.x+xo > sim_settings.width-1 || sim_state.mouse.y+yo < 0 || sim_state.mouse.y+yo > sim_settings.height-1)) {
                    if(cells[sim_state.mouse.x+xo][sim_state.mouse.y+yo].type == "AIR" || sim_state.current_place_type == "AIR") {
                        new Cell(sim_state.current_place_type,20,sim_state.mouse.x+xo,sim_state.mouse.y+yo,0,0,0);
                    }
                }
            }    
        }
    }
    drawAll();
    let drawEnd = Date.now();
    ctx.fillStyle = "#00FFFF";
    if(sim_state.framecount % 60 == 0) console.log(`[loop] took ${Date.now()-startTime}ms, spending ${physEnd-physStart}ms on physics, and ${drawEnd-drawStart}ms on rendering.`);
    if(sim_state.running) setTimeout(loop,15)
}

canvas.addEventListener("mousemove", e => {
    // ChatGPT wrote most of this code, which is why it's kinda shit.
    // What makes that fact worse is that I gave it an entire copy of this game's source code,
    // tried dozens of times to get it to just Fucking Work, and it just could not do it.
    // the offending lines of code are ...
    let rect = canvas.getBoundingClientRect();
    let cx = e.clientX - rect.left;
    let cy = e.clientY - rect.top;
    let simX = cx / sim_settings.zoom;  // this one
    let simY = cy / sim_settings.zoom;  // and this one. Notice how simple they are? I wrote those. ChatGPT couldn't figure it out.
                                        // Whoever says that AI is gonna take over the world is delusional.
    sim_state.mouse.x = Math.max(0, Math.min(sim_settings.width - 1, Math.floor(simX)));
    sim_state.mouse.y = Math.max(0, Math.min(sim_settings.height - 1, Math.floor(simY)));
});

canvas.addEventListener("mousedown", _ => {
    sim_state.mouse.clicking = true;
});

document.addEventListener("mouseup", _ => {
    sim_state.mouse.clicking = false;
});

particle_chooser.addEventListener("change", e => {
    console.log(particle_chooser.value);
    sim_state.current_place_type = particle_chooser.value;
});

brush_size_slider.addEventListener("change", e => {
    sim_state.brush_size = Number(brush_size_slider.value);
});

sim_state.running = true;
loop();