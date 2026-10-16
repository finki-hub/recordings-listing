import type { Translations } from '../i18n.ts';

export const tr = {
  brand: 'FINKI Hub',
  courses: 'Dersler',
  description: 'FINKI derslerine ait kayıtlar',
  favorites: {
    add: 'Favorilere ekle',
    remove: 'Favorilerden kaldır',
    title: 'Favoriler',
  },
  footer:
    'Bu resmî olmayan bir sitedir. Kayıt bağlantıları herkese açıktır; kayıtların sahibi değiliz ve kayıtları barındırmıyoruz. Tüm telif hakları FINKI’ye aittir.',
  home: {
    browse: 'Tüm dersleri inceleyin',
    contribute: 'Nasıl katkıda bulunabilirsiniz?',
    coursesDetails:
      'Her sayfa, bir derse ait kayıtları, oynatma listelerini ve notları bir araya getirir.',
    coursesTitle: 'Derslere göre',
    linksDetails:
      'Haftalara veya konulara göre sıralanan kayıtlar; teorik ders, uygulama ve danışma saatleri gibi açık etiketlerle sunulur.',
    linksTitle: 'Düzenli bağlantılar',
    navigationDetails: 'Yan menüden tüm derslere kolayca ulaşabilirsiniz.',
    navigationTitle: 'Hızlı gezinme',
    tagline: 'Derslere göre düzenlenmiş, tek bir yerde.',
    text: 'Teorik ders ve uygulama kayıtları.',
  },
  introduction: {
    closing: 'İyi çalışmalar ve sınavlarınızda başarılar!',
    contributeBody:
      'Yeni bağlantılarınız varsa veya bir hata fark ederseniz depoda bir değişiklik önerisi (pull request) ya da sorun kaydı (issue) açabilirsiniz. Yönergeler:',
    contributeHeading: 'Katkıda bulunun',
    contributeLinks:
      'Kısa bir açıklama ve düzenli bir kayıt bağlantıları listesi ekleyin',
    contributePage:
      'Yeni bir ders için `courses/` dizinine yeni bir `.md` sayfası ekleyin',
    contributeStyle: 'Mevcut sayfaların stiline ve biçimine uyun',
    description:
      'Bu site, FINKI derslerinin teorik ders kayıtlarına, uygulamalarına ve ek materyallerine yönelik bağlantıları bir araya getiren resmî olmayan bir derlemedir. Amaç, öğrencilerin kayıtlara tek bir yerden kolayca ulaşmasını ve dersleri takip etmesini sağlamaktır.',
    educational: 'İçerik yalnızca eğitim amacıyla paylaşılmaktadır',
    findFormats:
      'Kayıt türüne ilişkin bilgiler (teorik ders, laboratuvar, danışma saatleri)',
    findHeading: 'Burada neler bulabilirsiniz?',
    findNotes: 'Dersle ilgili notlar veya yararlı kaynaklar',
    findPlaylists: 'Varsa oynatma listeleri (YouTube vb.)',
    findRecordings: 'Haftalara veya konulara göre kayıt bağlantıları',
    organizationBody:
      'Her dersin ayrı bir Markdown sayfası vardır. Kolayca gezinebilmeniz için sayfalar yan menüde listelenir. Örnek ders:',
    organizationHeading: 'Derslere göre düzenleme',
    removal:
      'Hak sahibiyseniz ve bir içeriğin kaldırılmasını istiyorsanız depo üzerinden bizimle iletişime geçin',
    rights:
      'Kayıtlara ilişkin tüm haklar, hak sahiplerine veya kayıtların oluşturucularına aittir',
    rightsHeading: 'Notlar ve telif hakları',
    startBody:
      'Bir derse ait tüm kayıtlara ve yararlı bağlantılara ulaşmak için yan menüden dersi seçin.',
    startTitle: 'Nasıl başlanır?',
    unofficial: 'Bu proje resmî değildir ve FINKI ile bağlantılı değildir',
  },
  language: 'Dil',
  learnify: {
    after: ' sitesini ziyaret edin.',
    before: 'Bu ders için özel ders almak isterseniz',
    title: 'Özel dersler',
  },
  nav: { home: 'Ana sayfa', introduction: 'Giriş' },
  notes: {
    grouping: 'Bağlantıların gruplandırılması ve sıralanması iyileştirilebilir',
    mismatchedExercises:
      'Teorik ders ve uygulama kayıtları büyük olasılıkla birbiriyle örtüşmüyor; yalnızca sıralamaları doğrudur',
    none: 'Yok',
    olderRecordings: 'Teorik dersler için eski kayıtlar da bulunmaktadır',
  },
  search: {
    button: { buttonAriaLabel: 'Ara', buttonText: 'Ara' },
    modal: {
      backButtonTitle: 'Geri',
      displayDetails: 'Ayrıntıları göster',
      footer: {
        closeKeyAriaLabel: 'Escape',
        closeText: 'kapat',
        navigateDownKeyAriaLabel: 'Aşağı ok',
        navigateText: 'gezin',
        navigateUpKeyAriaLabel: 'Yukarı ok',
        selectKeyAriaLabel: 'Enter',
        selectText: 'seç',
      },
      noResultsText: 'Sonuç bulunamadı',
      resetButtonTitle: 'Aramayı temizle',
    },
  },
  sections: {
    additional: 'Ek içerik',
    exercises: 'Uygulama dersleri',
    exercisesAndLabs: 'Uygulama dersleri + Laboratuvar çalışmaları',
    lectures: 'Teorik dersler',
    lecturesAndExercises: 'Teorik dersler + Uygulama dersleri',
    notes: 'Notlar',
  },
  semester: '{number}. yarıyıl',
  theme: {
    darkModeSwitchLabel: 'Tema',
    darkModeSwitchTitle: 'Koyu tema',
    extraMenuLabel: 'Diğer seçenekler',
    lightModeSwitchTitle: 'Açık tema',
    navMenuLabel: 'Ana gezinme',
    notFoundLinkLabel: 'Ana sayfaya dön',
    notFoundLinkText: 'Ana sayfaya dön',
    notFoundQuote: 'Adresi kontrol edin veya ana sayfaya dönün.',
    notFoundTitle: 'SAYFA BULUNAMADI',
    outlineLabel: 'İçindekiler',
    permalink: '“{title}” için kalıcı bağlantı',
    returnToTopLabel: 'Başa dön',
    sidebarMenuLabel: 'Menü',
    sidebarNavigation: 'Dersler arasında gezinme',
    skipToContentLabel: 'İçeriğe geç',
  },
  title: 'FINKI Hub / Kayıtlar',
} as const satisfies Translations;
