import iconScarps from '../../assets/credits/scarps.png'
import logoArt from '../../assets/credits/qonlang-logo.svg'

/** 开发者与致谢名单复制自千语集 Welcome.svelte，姓名和链接保持原样。 */
export const DEV = {
  name: 'Kinnuch',
  site: 'https://kinnuch.github.io',
  github: 'https://github.com/Kinnuch',
  email: 'kinnuch@pku.edu.cn',
  bilibili: 'https://space.bilibili.com/204354828',
  bilibiliName: '凯岩城の冰原狼'
}

export const CREDITS: {
  role: 'logoDesign' | 'pixelArt' | 'sponsors' | 'testing' | 'other'
  names: { name: string; icon?: string; art?: 'pixel' | 'logo' }[]
}[] = [
  {
    role: 'logoDesign',
    names: [{ name: 'kikomas', icon: logoArt, art: 'logo' }, { name: 'sgiofh' }]
  },
  { role: 'pixelArt', names: [{ name: 'scarps', icon: iconScarps, art: 'pixel' }] },
  { role: 'sponsors', names: [{ name: 'Kyiexitah' }, { name: 'kikomas' }, { name: 'Cathamos' }] },
  {
    role: 'testing',
    names: [
      { name: 'Cathamos' },
      { name: 'kikomas' },
      { name: '见坂静安' },
      { name: '呼延式微1997' },
      { name: 'sgiofh' },
      { name: '夏穆' },
      { name: 'Kyiexitah' },
      { name: 'Sicusa' },
      { name: 'Ethan Delanche' }
    ]
  },
  { role: 'other', names: [{ name: '老婆大人' }] }
]
