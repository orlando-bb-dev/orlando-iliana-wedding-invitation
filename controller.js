// Sistema de configuración responsiva
const ResponsiveConfig = {
    breakpoints: {
        mobile: 430,
        tablet: 768,
        desktop: 1024
    },
    
    getCurrentBreakpoint: function() {
        const width = window.innerWidth;
        if (width < this.breakpoints.mobile) return 'mobile';
        if (width < this.breakpoints.tablet) return 'tablet';
        if (width < this.breakpoints.desktop) return 'desktop';
        return 'wide';
    },
    
    getMarginForBreakpoint: function(breakpoint) {
        const margins = {
            mobile: 15,
            tablet: 25,
            desktop: 40,
            wide: 40
        };
        return margins[breakpoint] || 40;
    }
};

// Clase principal para controlar elementos flotantes
class FloatingElementController {
    constructor(options = {}) {
        this.elements = new Map();
        this.resizeTimeout = null;
        this.scrollTimeout = null;
        this.debounceDelay = options.debounceDelay || 50; // Más responsive
        this.lastBreakpoint = ResponsiveConfig.getCurrentBreakpoint();
        this.lastViewportWidth = this.getViewportWidth();
        this.lastScrollbarWidth = this.getScrollbarWidth();
        this.scrollObserver = null;
        
        this.init();
    }
    
    init() {
        // Bind methods para eventos
        this.handleResize = this.handleResize.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        
        // Escuchar tanto resize como scroll
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('scroll', this.handleScroll);
        
        // También escuchar cambios en el DOM que puedan afectar el scroll
        this.observeScrollChanges();
    }
    
    // Registrar un nuevo elemento flotante
    register(elementSelector, containerSelector, options = {}) {
        const element = document.querySelector(elementSelector);
        const container = document.querySelector(containerSelector);
        
        if (!element || !container) {
            console.warn(`No se encontraron los elementos: ${elementSelector} o ${containerSelector}`);
            return false;
        }
        
        const config = {
            element,
            container,
            width: options.width || 80,
            margin: options.margin || null, // null = usar margin responsivo
            side: options.side || 'left', // 'left' o 'right'
            minMargin: options.minMargin || 10,
            customPosition: options.customPosition || null,
            initialPosition: null, // Guardamos la posición inicial
            applyFlex: options.applyFlex !== false // Por defecto true, se puede desactivar con false
        };
        
        this.elements.set(elementSelector, config);
        
        // Posición inicial con delay
        setTimeout(() => {
            this.updateElementPosition(elementSelector);
            // Guardar la posición inicial después del primer posicionamiento
            const updatedConfig = this.elements.get(elementSelector);
            if (updatedConfig) {
                updatedConfig.initialPosition = updatedConfig.element.style.left;
            }
        }, 100);
        
        return true;
    }
    
    // Desregistrar un elemento
    unregister(elementSelector) {
        this.elements.delete(elementSelector);
    }
    
    // Actualizar posición de un elemento específico
    updateElementPosition(elementSelector) {
        const config = this.elements.get(elementSelector);
        if (!config) return;
        
        const { element, container, width, margin, side, minMargin, customPosition, applyFlex } = config;
        
        // Si hay una función de posición personalizada, usarla
        if (customPosition && typeof customPosition === 'function') {
            customPosition(element, container, ResponsiveConfig.getCurrentBreakpoint());
            // Aplicar display flex después de la posición personalizada
            if (applyFlex) {
                element.style.display = 'flex';
            }
            return;
        }
        
        const containerRect = container.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const currentBreakpoint = ResponsiveConfig.getCurrentBreakpoint();
        
        // Determinar margen
        const adjustedMargin = margin !== null ? margin : ResponsiveConfig.getMarginForBreakpoint(currentBreakpoint);
        
        let position;
        
        if (side === 'right') {
            // Posicionar desde la derecha
            const rightPosition = containerRect.right - adjustedMargin - width;
            const maxRight = Math.min(rightPosition, windowWidth - width - minMargin);
            const minRight = containerRect.left + adjustedMargin;
            position = Math.min(Math.max(rightPosition, minRight), maxRight);
        } else {
            // Posicionar desde la izquierda (comportamiento original)
            let leftPosition = containerRect.left + adjustedMargin;
            const maxLeft = Math.min(
                containerRect.right - width - adjustedMargin,
                windowWidth - width - minMargin
            );
            const minLeft = Math.max(containerRect.left + adjustedMargin, minMargin);
            position = Math.min(Math.max(leftPosition, minLeft), maxLeft);
        }
        
        // Aplicar estilos de posición
        element.style.left = position + 'px';
        element.style.transform = 'none';
        element.style.marginLeft = '0';
        
        // Aplicar display flex al final del posicionamiento
        if (applyFlex) {
            element.style.display = 'flex';
        }
    }
    
    // Obtener el ancho real del viewport (sin scrollbar)
    getViewportWidth() {
        return document.documentElement.clientWidth || window.innerWidth;
    }
    
    // Detectar ancho de scrollbar
    getScrollbarWidth() {
        return window.innerWidth - document.documentElement.clientWidth;
    }
    
    // Observar cambios que puedan afectar el scroll
    observeScrollChanges() {
        // Verificar cambios más frecuentemente cuando hay elementos registrados
        this.scrollCheckInterval = setInterval(() => {
            this.checkViewportChange();
        }, 100); // Más frecuente para mejor detección
        
        // Observer para cambios en el DOM
        if (typeof MutationObserver !== 'undefined') {
            this.scrollObserver = new MutationObserver(() => {
                // Pequeño delay para que se apliquen los cambios de DOM
                setTimeout(() => this.checkViewportChange(), 10);
            });
            
            this.scrollObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        
        // Escuchar cambios en el tamaño del documento
        if (typeof ResizeObserver !== 'undefined') {
            this.documentObserver = new ResizeObserver(() => {
                this.checkViewportChange();
            });
            this.documentObserver.observe(document.documentElement);
        }
    }
    
    // Verificar si cambió el viewport o scrollbar
    checkViewportChange() {
        const currentViewportWidth = this.getViewportWidth();
        const currentScrollbarWidth = this.getScrollbarWidth();
        
        if (currentViewportWidth !== this.lastViewportWidth || 
            currentScrollbarWidth !== this.lastScrollbarWidth) {
            
            this.lastViewportWidth = currentViewportWidth;
            this.lastScrollbarWidth = currentScrollbarWidth;
            
            // Actualizar elementos con un pequeño delay para asegurar estabilidad
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => {
                this.updateAllElements();
            }, 10);
        }
    }
    
    // Manejar scroll
    handleScroll() {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            // Solo actualizar si realmente cambió algo relevante
            this.checkScrollbarChange();
        }, this.debounceDelay);
    }
    
    // Manejar resize con debounce - solo se ejecuta si cambia el breakpoint
    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            const currentBreakpoint = ResponsiveConfig.getCurrentBreakpoint();
            
            // Solo actualizar si cambió el breakpoint o el ancho cambió significativamente
            if (currentBreakpoint !== this.lastBreakpoint) {
                this.lastBreakpoint = currentBreakpoint;
                ResponsiveConfig.onResize && ResponsiveConfig.onResize();
                this.updateAllElements();
            }
        }, this.debounceDelay);
    }
    
    // Método para forzar actualización manual (si es necesario)
    forceUpdate() {
        this.updateAllElements();
    }
    
    // Actualizar todos los elementos registrados
    updateAllElements() {
        this.elements.forEach((config, selector) => {
            this.updateElementPosition(selector);
        });
    }
    
    // Limpiar event listeners
    destroy() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('scroll', this.handleScroll);
        
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
        }
        
        if (this.scrollCheckInterval) {
            clearInterval(this.scrollCheckInterval);
        }
        
        this.elements.clear();
    }



    checkScrollbarChange() {
        const currentScrollbarWidth = this.getScrollbarWidth();
        
        // Verificar si cambió el ancho de la scrollbar
        if (currentScrollbarWidth !== this.lastScrollbarWidth) {
            this.lastScrollbarWidth = currentScrollbarWidth;
            
            // Actualizar todos los elementos cuando cambia la scrollbar
            this.updateAllElements();
        }
    }

}

// Instancia global del controlador
const floatingController = new FloatingElementController();

// Función helper para facilitar el uso (mantiene compatibilidad con código existente)
function controlFloatingElement(elementSelector, containerSelector, options = {}) {
    return floatingController.register(elementSelector, containerSelector, options);
}

/* 
EJEMPLOS DE USO:

// Uso básico - aplica display: flex por defecto
controlFloatingElement('.mi-elemento', '.contenedor');

// Desactivar display: flex si no lo necesitas
controlFloatingElement('.mi-elemento', '.contenedor', {
    applyFlex: false
});

// Con opciones adicionales
controlFloatingElement('.mi-elemento', '.contenedor', {
    width: 100,
    side: 'right',
    margin: 30,
    applyFlex: true // explícitamente activado
});
*/



/*
document.addEventListener('DOMContentLoaded', function() {
    // Registrar múltiples elementos flotantes
    floatingController.register('.whatsapp_float', '.content', {
        width: 80,
        side: 'left'
    });
    
    floatingController.register('.chat-widget', '.main-container', {
        width: 100,
        side: 'right',
        margin: 30
    });
    
    floatingController.register('.help-button', '.content', {
        width: 60,
        side: 'left',
        margin: 20,
        customPosition: (element, container, breakpoint) => {
            // Lógica personalizada de posicionamiento
            const rect = container.getBoundingClientRect();
            element.style.left = rect.left + 'px';
            element.style.top = rect.top + 100 + 'px';
        }
    });
});
*/