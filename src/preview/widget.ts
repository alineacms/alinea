import {DOMAttributes} from 'react'

export function registerPreviewWidget() {
  if (customElements.get('alinea-preview')) return
  const observedAttributes = ['adminUrl', 'editUrl', 'livePreview']
  const template = `
    <div class="previews">
      <div class="inner">
        <a target="_top" class="button" title="Admin panel" id="btn-admin">
          <svg class="logo" viewBox="0 0 36 36" preserveAspectRatio="none">
            <path fill="#5763E6" d="M20.8178 10.3977V11.733C19.8978 10.6534 18.5316 10 16.6636 10C13.0112 10 10 13.267 10 17.5C10 21.733 13.0112 25 16.6636 25C18.5316 25 19.8978 24.3466 20.8178 23.267V24.6023H25V10.3977H20.8178ZM17.5 20.9659C15.5762 20.9659 14.1822 19.6307 14.1822 17.5C14.1822 15.3693 15.5762 14.0341 17.5 14.0341C19.4238 14.0341 20.8178 15.3693 20.8178 17.5C20.8178 19.6307 19.4238 20.9659 17.5 20.9659Z" />
          </svg>
        </a>
        <div class="connection" title="Previewing live" id="preview-disabled">
          <svg  class="icon" width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M11 22v-8.275q-.45-.275-.725-.712T10 12q0-.825.588-1.412T12 10t1.413.588T14 12q0 .575-.275 1.025t-.725.7V22zm-5.9-2.75q-1.425-1.375-2.262-3.238T2 12q0-2.075.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12q0 2.15-.837 4.025T18.9 19.25l-1.4-1.4q1.15-1.1 1.825-2.613T20 12q0-3.35-2.325-5.675T12 4T6.325 6.325T4 12q0 1.725.675 3.225t1.85 2.6zm2.825-2.825q-.875-.825-1.4-1.963T6 12q0-2.5 1.75-4.25T12 6t4.25 1.75T18 12q0 1.325-.525 2.475t-1.4 1.95L14.65 15q.625-.575.988-1.35T16 12q0-1.65-1.175-2.825T12 8T9.175 9.175T8 12q0 .9.363 1.663T9.35 15z"/>
          </svg>
        </div>
        <span class="separator"></span>
        <a target="_top" class="button" title="Edit content" id="btn-edit">
          <svg class="icon" width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="#5763E6" d="M3 17.46v3.04c0 .28.22.5.5.5h3.04c.13 0 .26-.05.35-.15L17.81 9.94l-3.75-3.75L3.15 17.1c-.1.1-.15.22-.15.36M20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83l3.75 3.75z"/>
          </svg>
        </a>
      </div>
    </div>
  `
  const styles = `
    :host {
      display: contents;
    }
    .previews {
      position: fixed;
      bottom: 15px;
      left: 50%;
      z-index: 9999;
    }
    .inner {
      display: flex;
      align-items: center;
      background: #fff;
      border-radius: 17.5px;
      box-shadow: 0 0 1.4px rgba(0,0,0,.1), 0 2px 3.5px rgba(0,0,0,.1);
      z-index: 1000;
      height: 35px;
      font-size: 14px;
      font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      transform: translateX(-50%);
      border: 1.5px solid #E4E4E7;
      transition: border 0.2s ease-out;
      animation: fade-in 0.3s ease-out;
    }
    .inner.is-centered {
      border-color: #8189e5;
    }
    .inner[data-dragging="true"] {
      cursor: grabbing;
    }
    .inner[data-dragging="true"] * {
      pointer-events: none;
    }
    .logo {
      display: block;
      height: 25px;
      width: auto;
      flex-shrink: 0;
    }
    .icon {
      display: block;
      font-size: 16px;
    }
    .button {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      color: #596e8d;
      white-space: nowrap;
      height: 100%;
      width: 45px;
    }
    .button:hover {
      color: #000;
    }
    .connection {
      display: none;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      margin-left: -6px;
      margin-top: -1px;
      padding-right: 13px;
      height: 100%;
    }
    .is-connected .connection {
      display: flex;
      color: #5763E6;
    }
    .is-warning .connection {
      display: flex;
      color: #bf1029;
    }
    .is-loading .connection {
      display: flex;
      color: #5763E6;
      animation: pulse 1s linear infinite;
    }
    .separator {
      display: block;
      border-left: 1px solid #E4E4E7;
      height: 16px;
    }
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translate(-50%, 10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%);
      }
    }
  `

  class AlineaPreview extends HTMLElement {
    static observedAttributes = observedAttributes
    #previews?: HTMLDivElement
    #adminButton?: HTMLAnchorElement
    #editButton?: HTMLAnchorElement
    #disconnect!: () => void

    disconnectedCallback() {
      this.#disconnect()
    }

    setAttribute(name: string, value: string | null) {
      switch (name) {
        case 'adminUrl':
          if (this.#adminButton) this.#adminButton.href = value ?? ''
          return
        case 'editUrl':
          if (this.#editButton) this.#editButton.href = value ?? ''
          return
        case 'livePreview':
          this.#previews?.classList.toggle('is-loading', value === 'loading')
          this.#previews?.classList.toggle(
            'is-connected',
            value === 'connected'
          )
          this.#previews?.classList.toggle('is-warning', value === 'warning')
          return
      }
    }

    attributeChangedCallback(
      name: string,
      oldValue: string | null,
      newValue: string | null
    ) {
      this.setAttribute(name, newValue)
    }

    connectedCallback() {
      const shadow = this.attachShadow({mode: 'open'})
      const style = document.createElement('style')
      style.textContent = styles
      shadow.appendChild(style)
      const wrapper = document.createElement('div')
      wrapper.innerHTML = template
      shadow.appendChild(wrapper)
      const previews: HTMLDivElement = wrapper.querySelector('.previews')!
      this.#previews = previews
      const inner: HTMLDivElement = wrapper.querySelector('.inner')!
      this.#adminButton = previews.querySelector('#btn-admin')!
      this.#editButton = previews.querySelector('#btn-edit')!

      for (const attr of AlineaPreview.observedAttributes)
        this.setAttribute(attr, this.getAttribute(attr))

      this.attributeChangedCallback = (name, oldValue, newValue) => {
        this.setAttribute(name, newValue)
      }

      let xPosition = 0.5
      previews.addEventListener('mousedown', startDrag)
      function startDrag(event: MouseEvent) {
        event.preventDefault()
        let current = xPosition
        const startX = event.clientX
        const startOffset = xPosition
        const windowWidth = window.innerWidth
        const containerWidth = previews.clientWidth
        const minOffset = containerWidth / 2
        function move(event: MouseEvent) {
          inner.dataset.dragging = 'true'
          const deltaX = event.clientX - startX
          let newX = Math.max(
            0,
            Math.min(1, startOffset + deltaX / windowWidth)
          )
          const min = minOffset / windowWidth
          if (newX < min) newX = min
          const max = 1 - min
          if (newX > max) newX = max
          current = newX
          previews.style.left = newX * 100 + '%'
          xPosition = newX
        }
        function stop() {
          const isCentered = Math.abs(current - 0.5) < 0.05
          if (isCentered) {
            previews.style.left = '50%'
            xPosition = 0.5
          }
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', stop)
          inner.dataset.dragging = undefined
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', stop)
      }

      this.#disconnect = () => {
        previews.removeEventListener('mousedown', startDrag)
      }
    }
  }

  customElements.define('alinea-preview', AlineaPreview)
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ['alinea-preview']: DOMAttributes<HTMLElement> & {
        adminUrl: string
        editUrl: string
        livePreview?: 'connected' | 'warning' | 'loading'
      }
    }
  }
}
