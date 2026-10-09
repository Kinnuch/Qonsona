/**
 * 主题词本：한국어기초사전给初中级词标的「主题」（주제，80 个，跟韩语教材的单元主题一致）。
 * 词表名 theme:<id>；id 用简短的英文，名字中英两种（自己译的）。
 */
export interface Theme {
  id: string
  ko: string
  zh: string
  en: string
}

export const THEMES: Theme[] = [
  { id: 'greeting', ko: '인사하기', zh: '打招呼', en: 'Greetings' },
  { id: 'intro-self', ko: '소개하기(자기소개)', zh: '自我介绍', en: 'Introducing yourself' },
  { id: 'intro-family', ko: '소개하기(가족 소개)', zh: '介绍家人', en: 'Introducing your family' },
  { id: 'personal-info', ko: '개인 정보 교환하기', zh: '交换个人信息', en: 'Personal information' },
  { id: 'thanks', ko: '감사하기', zh: '道谢', en: 'Thanking' },
  { id: 'apology', ko: '사과하기', zh: '道歉', en: 'Apologizing' },
  { id: 'appointment', ko: '약속하기', zh: '约定', en: 'Making plans' },
  { id: 'phone', ko: '전화하기', zh: '打电话', en: 'Phone calls' },
  { id: 'invitation', ko: '초대와 방문', zh: '邀请与拜访', en: 'Invitations and visits' },
  { id: 'time', ko: '시간 표현하기', zh: '表达时间', en: 'Telling the time' },
  { id: 'date', ko: '날짜 표현하기', zh: '表达日期', en: 'Dates' },
  { id: 'weekday', ko: '요일 표현하기', zh: '星期', en: 'Days of the week' },
  { id: 'daily', ko: '하루 생활', zh: '一天的生活', en: 'Daily routine' },
  { id: 'weather', ko: '날씨와 계절', zh: '天气与季节', en: 'Weather and seasons' },
  { id: 'climate', ko: '기후', zh: '气候', en: 'Climate' },
  { id: 'location', ko: '위치 표현하기', zh: '表达位置', en: 'Locations' },
  { id: 'directions', ko: '길찾기', zh: '问路', en: 'Finding the way' },
  { id: 'transport', ko: '교통 이용하기', zh: '乘坐交通工具', en: 'Transport' },
  { id: 'shopping', ko: '물건 사기', zh: '买东西', en: 'Shopping' },
  { id: 'ordering', ko: '음식 주문하기', zh: '点菜', en: 'Ordering food' },
  { id: 'food-describe', ko: '음식 설명하기', zh: '描述食物', en: 'Describing food' },
  { id: 'cooking', ko: '요리 설명하기', zh: '讲做菜', en: 'Cooking' },
  { id: 'food-culture', ko: '식문화', zh: '饮食文化', en: 'Food culture' },
  { id: 'clothes', ko: '복장 표현하기', zh: '穿着打扮', en: 'Clothing' },
  { id: 'looks', ko: '외모 표현하기', zh: '描述外貌', en: 'Describing appearance' },
  { id: 'appearance', ko: '외양', zh: '外表', en: 'Appearance' },
  { id: 'personality', ko: '성격 표현하기', zh: '描述性格', en: 'Personality' },
  { id: 'feelings', ko: '감정, 기분 표현하기', zh: '表达情感与心情', en: 'Feelings and moods' },
  { id: 'psychology', ko: '심리', zh: '心理', en: 'Psychology' },
  { id: 'health', ko: '건강', zh: '健康', en: 'Health' },
  { id: 'hospital', ko: '병원 이용하기', zh: '去医院', en: 'At the hospital' },
  { id: 'pharmacy', ko: '약국 이용하기', zh: '去药店', en: 'At the pharmacy' },
  { id: 'medical', ko: '보건과 의료', zh: '保健与医疗', en: 'Health care and medicine' },
  { id: 'hobby', ko: '취미', zh: '爱好', en: 'Hobbies' },
  { id: 'leisure', ko: '여가 생활', zh: '休闲生活', en: 'Leisure' },
  { id: 'weekend', ko: '주말 및 휴가', zh: '周末与假期', en: 'Weekends and holidays' },
  { id: 'travel', ko: '여행', zh: '旅行', en: 'Travel' },
  { id: 'sports', ko: '스포츠', zh: '体育', en: 'Sports' },
  { id: 'movies', ko: '영화 보기', zh: '看电影', en: 'Going to the movies' },
  { id: 'performance', ko: '공연과 감상', zh: '演出与欣赏', en: 'Performances' },
  { id: 'pop-culture', ko: '대중 문화', zh: '大众文化', en: 'Pop culture' },
  { id: 'media', ko: '대중 매체', zh: '大众媒体', en: 'Mass media' },
  { id: 'press', ko: '언론', zh: '新闻媒体', en: 'The press' },
  { id: 'computer', ko: '컴퓨터와 인터넷', zh: '电脑与网络', en: 'Computers and the Internet' },
  { id: 'housework', ko: '집안일', zh: '家务', en: 'Housework' },
  { id: 'housing', ko: '주거 생활', zh: '居住', en: 'Housing' },
  { id: 'house-hunting', ko: '집 구하기', zh: '找房子', en: 'House hunting' },
  { id: 'family-events', ko: '가족 행사', zh: '家庭活动', en: 'Family events' },
  { id: 'holidays', ko: '가족 행사-명절', zh: '节日', en: 'Traditional holidays' },
  { id: 'love', ko: '연애와 결혼', zh: '恋爱与婚姻', en: 'Love and marriage' },
  { id: 'relationships', ko: '인간관계', zh: '人际关系', en: 'Relationships' },
  { id: 'school', ko: '학교생활', zh: '学校生活', en: 'School life' },
  { id: 'education', ko: '교육', zh: '教育', en: 'Education' },
  { id: 'language', ko: '언어', zh: '语言', en: 'Language' },
  { id: 'work', ko: '직장 생활', zh: '职场生活', en: 'Working life' },
  { id: 'jobs', ko: '직업과 진로', zh: '职业与出路', en: 'Jobs and careers' },
  { id: 'public', ko: '공공기관 이용하기', zh: '去公共机关', en: 'Public offices' },
  { id: 'library', ko: '공공 기관 이용하기(도서관)', zh: '去图书馆', en: 'At the library' },
  { id: 'post-office', ko: '공공 기관 이용하기(우체국)', zh: '去邮局', en: 'At the post office' },
  {
    id: 'immigration',
    ko: '공공 기관 이용하기(출입국 관리 사무소)',
    zh: '去出入境管理处',
    en: 'At the immigration office'
  },
  {
    id: 'lost-broken',
    ko: '문제 해결하기(분실 및 고장)',
    zh: '解决问题（丢失与故障）',
    en: 'Problems (lost and broken things)'
  },
  { id: 'mistakes', ko: '실수담 말하기', zh: '讲出错的经历', en: 'Talking about mistakes' },
  {
    id: 'incidents',
    ko: '사건, 사고, 재해 기술하기',
    zh: '描述事件、事故与灾害',
    en: 'Incidents, accidents and disasters'
  },
  { id: 'life-in-korea', ko: '한국 생활', zh: '在韩国生活', en: 'Living in Korea' },
  { id: 'culture-diff', ko: '문화 차이', zh: '文化差异', en: 'Cultural differences' },
  { id: 'culture-compare', ko: '문화 비교하기', zh: '比较文化', en: 'Comparing cultures' },
  { id: 'literature', ko: '한국의 문학', zh: '韩国文学', en: 'Korean literature' },
  { id: 'arts', ko: '예술', zh: '艺术', en: 'The arts' },
  { id: 'architecture', ko: '건축', zh: '建筑', en: 'Architecture' },
  { id: 'religion', ko: '종교', zh: '宗教', en: 'Religion' },
  { id: 'history', ko: '역사', zh: '历史', en: 'History' },
  { id: 'philosophy', ko: '철학·윤리', zh: '哲学与伦理', en: 'Philosophy and ethics' },
  { id: 'geography', ko: '지리 정보', zh: '地理', en: 'Geography' },
  { id: 'science', ko: '과학과 기술', zh: '科学与技术', en: 'Science and technology' },
  { id: 'environment', ko: '환경 문제', zh: '环境问题', en: 'Environmental issues' },
  { id: 'social-issues', ko: '사회 문제', zh: '社会问题', en: 'Social issues' },
  { id: 'social-system', ko: '사회 제도', zh: '社会制度', en: 'Social systems' },
  { id: 'politics', ko: '정치', zh: '政治', en: 'Politics' },
  { id: 'economy', ko: '경제·경영', zh: '经济与经营', en: 'Economy and business' },
  { id: 'law', ko: '법', zh: '法律', en: 'Law' }
]

export const THEME_BY_KO = new Map(THEMES.map((t) => [t.ko, t]))
