import { Book, Chapter } from '../types/book';

// Helper to bundle chapters for curated PDF books without heavy pre-baked data URLs
function createPdfBook(
  id: string,
  title: string,
  subtitle: string,
  author: string,
  pdfFileName: string,
  pdfFileSize: string,
  coverGradient: string,
  accentColor: string,
  totalPages: number,
  description: string,
  chapters: Chapter[]
): Book {
  return {
    id,
    title,
    subtitle,
    author,
    genre: 'PDF & Documents',
    coverGradient,
    accentColor,
    rating: 4.98,
    reviewCount: 420,
    totalPages,
    currentPage: 1,
    currentChapterId: chapters[0]?.id || 'ch1',
    progressPercent: 10,
    isPdf: true,
    pdfFileName,
    pdfFileSize,
    pdfPageCount: totalPages,
    addedAt: '2026-03-15',
    lastReadAt: '2026-10-14T08:00:00Z',
    description,
    chapters,
  };
}

const BITCOIN_CHAPTERS: Chapter[] = [
  {
    id: 'btc-ch1',
    title: 'Page 1: Abstract & 1. Introduction',
    readingTimeMinutes: 4,
    content: [
      'Commerce on the Internet has come to rely almost exclusively on financial institutions serving as trusted third parties to process electronic payments. While the system works well enough for most transactions, it still suffers from the inherent weaknesses of the trust based model.',
      'Completely non-reversible transactions are not really possible, since financial institutions cannot avoid mediating disputes. The cost of mediation increases transaction costs, limiting the minimum practical transaction size and cutting off the possibility for small casual transactions.',
      'What is needed is an electronic payment system based on cryptographic proof instead of trust, allowing any two willing parties to transact directly with each other without the need for a trusted third party.',
      'In this paper, we propose a solution to the double-spending problem using a peer-to-peer distributed timestamp server to generate computational proof of the chronological order of transactions. The system is secure as long as honest nodes collectively control more CPU power than any cooperating group of attacker nodes.',
    ],
  },
  {
    id: 'btc-ch2',
    title: 'Page 2: 2. Transactions & Digital Signatures',
    readingTimeMinutes: 4,
    content: [
      'We define an electronic coin as a chain of digital signatures. Each owner transfers the coin to the next by digitally signing a hash of the previous transaction and the public key of the next owner and adding these to the end of the coin.',
      'A payee can verify the signatures to verify the chain of ownership. The problem of course is the payee cannot verify that one of the owners did not double-spend the coin.',
      'A common solution is to introduce a trusted central authority, or mint, that checks every transaction for double spending. After each transaction, the coin must be returned to the mint to issue a new coin, and only coins issued directly from the mint are trusted not to be double-spent.',
      'We need a way for the payee to know that the previous owners did not sign any earlier transactions. For our purposes, the earliest transaction is the one that counts, so we do not care about later attempts to double-spend. The only way to confirm the absence of a transaction is to be aware of all transactions.',
    ],
  },
  {
    id: 'btc-ch3',
    title: 'Page 3: 3. Timestamp Server & Hashcash',
    readingTimeMinutes: 4,
    content: [
      'The solution we propose begins with a timestamp server. A timestamp server works by taking a hash of a block of items to be timestamped and widely publishing the hash, such as in a newspaper or Usenet post.',
      'The timestamp proves that the data must have existed at the time, obviously, in order to get into the hash.',
      'Each timestamp includes the previous timestamp in its hash, forming a chain, with each additional timestamp reinforcing the ones before it.',
      'To implement a distributed timestamp server on a peer-to-peer basis, we will need to use a proof-of-work system similar to Adam Back’s Hashcash, rather than newspaper or Usenet posts.',
    ],
  },
  {
    id: 'btc-ch4',
    title: 'Page 4: 4. Proof-of-Work Consensus',
    readingTimeMinutes: 5,
    content: [
      'The proof-of-work involves scanning for a value that when hashed, such as with SHA-256, the hash begins with a number of zero bits. The average work required is exponential in the number of zero bits required and can be verified by executing a single hash.',
      'For our timestamp network, we implement the proof-of-work by incrementing a nonce in the block until a value is found that gives the block’s hash the required zero bits.',
      'Once the CPU effort has been expended to make it satisfy the proof-of-work, the block cannot be changed without redoing the work. As later blocks are chained after it, the work to change the block would include redoing all the blocks after it.',
      'Proof-of-work also solves the problem of determining representation in majority decision making. If the majority were based on one-IP-address-one-vote, it could be subverted by anyone able to allocate many IPs. Proof-of-work is essentially one-CPU-one-vote.',
    ],
  },
  {
    id: 'btc-ch5',
    title: 'Page 5: 5. Network Steps & Node Propagation',
    readingTimeMinutes: 4,
    content: [
      'The steps to run the network are as follows:',
      '1) New transactions are broadcast to all nodes.\n2) Each node collects new transactions into a block.\n3) Each node works on finding a difficult proof-of-work for its block.\n4) When a node finds a proof-of-work, it broadcasts the block to all nodes.',
      '5) Nodes accept the block only if all transactions in it are valid and not already spent.\n6) Nodes express their acceptance of the block by working on creating the next block in the chain, using the hash of the accepted block as the previous hash.',
      'Nodes always consider the longest chain to be the correct one and will keep working on extending it. If two nodes broadcast different versions of the next block simultaneously, some nodes may receive one or the other first. In that case, they work on the first one they received, but save the other branch in case it becomes longer.',
    ],
  },
  {
    id: 'btc-ch6',
    title: 'Page 6: 6. Incentive & Distribution Mechanics',
    readingTimeMinutes: 4,
    content: [
      'By convention, the first transaction in a block is a special transaction that starts a new coin owned by the creator of the block. This adds an incentive for nodes to support the network, and provides a way to initially distribute coins into circulation, since there is no central authority to issue them.',
      'The steady addition of a constant amount of new coins is analogous to gold miners expending resources to add gold to circulation. In our case, it is CPU time and electricity that is expended.',
      'The incentive can also be funded with transaction fees. If the output value of a transaction is less than its input value, the difference is a transaction fee that is added to the incentive value of the block containing the transaction.',
      'Once a predetermined number of coins have entered circulation, the incentive can transition entirely to transaction fees and be completely inflation free.',
    ],
  },
  {
    id: 'btc-ch7',
    title: 'Page 7: 7. Reclaiming Disk Space & Merkle Trees',
    readingTimeMinutes: 4,
    content: [
      'Once the latest transaction in a coin is buried under enough blocks, the spent transactions before it can be discarded to save disk space.',
      'To facilitate this without breaking the block’s hash, transactions are hashed in a Merkle Tree, with only the root included in the block’s hash.',
      'Old blocks can then be compacted by stubbing off branches of the tree. The interior hashes do not need to be stored.',
      'A block header with no transactions is about 80 bytes. If we suppose blocks are generated every 10 minutes, 80 bytes * 6 * 24 * 365 = 4.2MB per year. With computer systems typically selling with 2GB of RAM in 2008, and Moore’s Law predicting growth, storage will not be a problem even if the headers must be kept in memory.',
    ],
  },
  {
    id: 'btc-ch8',
    title: 'Page 8: 8. Simplified Payment Verification (SPV)',
    readingTimeMinutes: 4,
    content: [
      'It is possible to verify payments without running a full network node. A user only needs to keep a copy of the block headers of the longest proof-of-work chain, which he can get by querying network nodes until he’s convinced he has the longest chain, and obtain the Merkle branch linking the transaction to the block it’s timestamped in.',
      'He cannot check the transaction for himself, but by linking it to a place in the chain, he can see that a network node has accepted it, and blocks added after it further confirm the network has accepted it.',
      'As such, the verification is reliable as long as honest nodes control the network, but is more vulnerable if the network is overpowered by an attacker.',
      'While network nodes can verify transactions for themselves, the simplified method can be fooled by an attacker’s fabricated transactions for as long as the attacker can continue to overpower the network.',
    ],
  },
  {
    id: 'btc-ch9',
    title: 'Page 9: 9. Value Splitting & 10. Privacy Guarantees',
    readingTimeMinutes: 5,
    content: [
      'Although it would be possible to handle coins individually, it would be unwieldy to make a separate transaction for every cent in a transfer. To allow value to be split and combined, transactions contain multiple inputs and outputs.',
      'Normally there will be either a single input from a larger previous transaction or multiple inputs combining smaller amounts, and at most two outputs: one for the payment, and one returning the change, if any, back to the sender.',
      'The traditional banking model achieves a level of privacy by limiting access to information to the parties involved and the trusted third party. The necessity to announce all transactions publicly precludes this method, but privacy can still be maintained by breaking the flow of information in another place: by keeping public keys anonymous.',
      'The public can see that someone is sending an amount to someone else, but without information linking the transaction to anyone. This is similar to the level of information released by stock exchanges, where the time and size of individual trades is made public, but without telling who the parties were.',
    ],
  },
];

const ATTENTION_CHAPTERS: Chapter[] = [
  {
    id: 'att-ch1',
    title: 'Page 1: Abstract & 1. Introduction',
    readingTimeMinutes: 4,
    content: [
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism.',
      'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
      'Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.',
      'Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU.',
    ],
  },
  {
    id: 'att-ch2',
    title: 'Page 2: 2. Background & Recurrence Limitations',
    readingTimeMinutes: 5,
    content: [
      'The goal of reducing sequential computation also forms the foundation of the Extended Neural GPU, ByteNet and ConvS2S, all of which use convolutional neural networks as basic building blocks, computing hidden representations in parallel for all input and output positions.',
      'In these models, the number of operations required to relate signals from two arbitrary input or output positions grows in the distance between positions, linearly for ConvS2S and logarithmically for ByteNet.',
      'This makes it more difficult to learn dependencies between distant positions. In the Transformer this is reduced to a constant number of operations, albeit at the cost of reduced effective resolution due to averaging attention-weighted positions.',
      'Self-attention, sometimes called intra-attention is an attention mechanism relating different positions of a single sequence in order to compute a representation of the sequence.',
    ],
  },
  {
    id: 'att-ch3',
    title: 'Page 3: 3. Model Architecture Overview',
    readingTimeMinutes: 5,
    content: [
      'Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations (x_1, ..., x_n) to a sequence of continuous representations z = (z_1, ..., z_n).',
      'Given z, the decoder then generates an output sequence (y_1, ..., y_m) of symbols one element at a time. At each step the model is auto-regressive, consuming the previously generated symbols as additional input when generating the next.',
      'The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.',
      'The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers: a multi-head self-attention mechanism, and a simple, position-wise fully connected feed-forward network. We employ a residual connection around each of the two sub-layers, followed by layer normalization.',
    ],
  },
  {
    id: 'att-ch4',
    title: 'Page 4: 3.2.1 Scaled Dot-Product Attention',
    readingTimeMinutes: 5,
    content: [
      'We call our particular attention "Scaled Dot-Product Attention". The input consists of queries and keys of dimension d_k, and values of dimension d_v.',
      'We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function to obtain the weights on the values.',
      'In practice, we compute the attention function on a set of queries simultaneously, packed together into a matrix Q. The keys and values are also packed together into matrices K and V.',
      'We compute the matrix of outputs as: Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V. We scale by 1 / sqrt(d_k) to counteract the effect of dot products growing large in magnitude for large values of d_k, which pushes the softmax into regions with extremely small gradients.',
    ],
  },
  {
    id: 'att-ch5',
    title: 'Page 5: 3.2.2 Multi-Head Attention Mechanism',
    readingTimeMinutes: 5,
    content: [
      'Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d_k, d_k and d_v dimensions, respectively.',
      'On each of these projected versions of queries, keys and values we then perform the attention function in parallel, yielding d_v-dimensional output values. These are concatenated and once again projected, resulting in the final values.',
      'Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.',
      'In this work we employ h = 8 parallel attention layers, or heads. For each of these we use d_k = d_v = d_model / h = 64. Due to the reduced dimension of each head, the total computational cost is similar to that of single-head attention with full dimensionality.',
    ],
  },
  {
    id: 'att-ch6',
    title: 'Page 6: 3.5 Positional Encoding',
    readingTimeMinutes: 4,
    content: [
      'Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence.',
      'To this end, we add "positional encodings" to the input embeddings at the bottoms of the encoder and decoder stacks. The positional encodings have the same dimension d_model as the embeddings, so that the two can be summed.',
      'There are many choices of positional encodings, learned and fixed. In this work, we use sine and cosine functions of different frequencies:',
      'PE_(pos, 2i) = sin(pos / 10000^(2i / d_model))\nPE_(pos, 2i+1) = cos(pos / 10000^(2i / d_model)). We chose this because it allows the model to easily learn to attend by relative positions, since for any fixed offset k, PE_(pos+k) can be represented as a linear function of PE_pos.',
    ],
  },
  {
    id: 'att-ch7',
    title: 'Page 7: 4. Why Self-Attention Wins',
    readingTimeMinutes: 4,
    content: [
      'In this section we compare various aspects of self-attention layers to the recurrent and convolutional layers commonly used for mapping one variable-length sequence of symbol representations to another sequence of equal length.',
      'Three desiderata motivate our choice:',
      '1) The total computational complexity per layer.\n2) The amount of computation that can be parallelized, measured by the minimum number of sequential operations required.',
      '3) The path length between long-range dependencies in the network. A self-attention layer connects all positions with a constant number of sequentially executed operations O(1), whereas a recurrent layer requires O(n) sequential operations. In terms of computational complexity, self-attention layers are faster than recurrent layers when the sequence length n is smaller than the representation dimensionality d.',
    ],
  },
  {
    id: 'att-ch8',
    title: 'Page 8: 5. Training & Regularization',
    readingTimeMinutes: 4,
    content: [
      'We trained on the standard WMT 2014 English-German dataset consisting of about 4.5 million sentence pairs. Sentences were encoded using byte-pair encoding, which has a shared source-target vocabulary of about 37000 tokens.',
      'We trained our models on one machine with 8 NVIDIA P100 GPUs. For our base models using the hyperparameters described throughout the paper, each training step took about 0.4 seconds. We trained the base models for a total of 100,000 steps or 12 hours.',
      'We used the Adam optimizer with beta_1 = 0.9, beta_2 = 0.98 and epsilon = 10^-9. We varied the learning rate over the course of training according to a schedule with 4000 warmup steps.',
      'We employed three types of regularization during training: Residual Dropout (P_drop = 0.1), Sub-layer Dropout, and Label Smoothing with value epsilon_ls = 0.1.',
    ],
  },
  {
    id: 'att-ch9',
    title: 'Page 9: 6. Results on Machine Translation',
    readingTimeMinutes: 4,
    content: [
      'On the WMT 2014 English-to-German translation task, the big transformer model outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new state-of-the-art BLEU score of 28.4.',
      'The configuration of this model is shown in the first line of Table 3. Training took 3.5 days on 8 P100 GPUs. Even our base model surpasses all previously published models and ensembles, at a fraction of the training cost of any of the competitive models.',
      'On the WMT 2014 English-to-French translation task, our big model achieves a BLEU score of 41.0, outperforming all of the previously published single models, at less than 1/4 the training cost of the previous state-of-the-art model.',
      'The Transformer is the first sequence transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.',
    ],
  },
  {
    id: 'att-ch10',
    title: 'Page 10: 7. Conclusion & Future Outlook',
    readingTimeMinutes: 4,
    content: [
      'In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-head self-attention.',
      'For translation tasks, the Transformer can be trained significantly faster than architectures based on recurrent or convolutional layers. On both WMT 2014 English-to-German and WMT 2014 English-to-French translation tasks, we achieve a new state of the art.',
      'We are excited about the future of attention-based models and plan to apply them to other tasks. We plan to extend the Transformer to problems involving input and output modalities other than text and to investigate local, restricted attention mechanisms to efficiently handle large inputs and outputs such as images, audio and video.',
      'Making generation less sequential is another of our research goals.',
    ],
  },
];

const SOVEREIGN_CHAPTERS: Chapter[] = [
  {
    id: 'sov-ch1',
    title: 'Page 1: The Transition to the Information Age',
    readingTimeMinutes: 6,
    content: [
      'The future will be very different from the past. Over the past five centuries, technological innovations consistently favored the centralization of power in the nation-state. Scale economies made mass armies, mass production, and mass taxation victorious.',
      'The Information Age radically reverses this trend. Microprocessing, asymmetric encryption, and decentralized computing shift the balance of power from the leviathan state to the sovereign individual.',
      'When commerce and capital take flight into cyberspace, physical borders become permeable and physical coercion loses its efficiency. The cost of protecting cryptographic information approaches zero, while the cost of extorting it approaches infinity.',
      'Those who master high-leverage intellectual capital, autonomous robotics, global liquidity, and sovereign thinking will enjoy unparalleled autonomy and compounding wealth.',
    ],
  },
  {
    id: 'sov-ch2',
    title: 'Page 2: Megapolitics, Cyber-Money & Capital Escrow',
    readingTimeMinutes: 6,
    content: [
      'Every major transition in human history has been governed by changes in the megapolitics of violence: the relative efficiency of attack versus defense.',
      'Cyber-commerce introduces non-political money: currency whose supply cannot be inflated by ministerial decree and whose custody cannot be confiscated at customs checkpoints.',
      'Jurisdictions will be compelled to treat productive citizens as customers rather than captive subjects, competing through lower transaction fees, rock-solid rule of law, and digital infrastructure.',
      'Building your family’s balance sheet across autonomous, high-integrity assets and cultivating unshakeable multidisciplinary competencies is the ultimate hedge against monetary fragility.',
    ],
  },
  {
    id: 'sov-ch3',
    title: 'Page 3: The Unbundling of the Welfare State',
    readingTimeMinutes: 6,
    content: [
      'As high-earning individuals gain the ability to custody and transact their capital beyond physical jurisdictions, the capability of governments to levy redistributive taxation diminishes exponentially.',
      'Governments will no longer be able to finance deficit spending through inflationary debasement of captive domestic currency.',
      'Public services—from physical security and dispute resolution to contract arbitration—will be unbundled into competitive, market-driven sovereign providers.',
      'Sovereignty will increasingly accrue to those who construct robust private infrastructure, resilient family balance sheets, and cross-border optionality.',
    ],
  },
  {
    id: 'sov-ch4',
    title: 'Page 4: The Sovereign Dynasty Playbook',
    readingTimeMinutes: 6,
    content: [
      'To thrive in the Information Era, family leaders must operate as decentralized sovereign entities.',
      'First: Custody core assets in verifiable, unconfiscatable forms. Eliminate single points of systemic failure.',
      'Second: Instill high-agency STEM, engineering, and capital allocation competencies across generations. The future belongs to those who build.',
      'Third: Maintain radical emotional composure and physical vitality. Clear thinking compounded over decades produces generational dominance.',
    ],
  },
];

const AS_A_MAN_THINKETH_CHAPTERS: Chapter[] = [
  {
    id: 'think-ch1',
    title: 'Page 1: Thought and Character',
    readingTimeMinutes: 5,
    content: [
      'The aphorism, "As a man thinketh in his heart so is he," not only embraces the whole of a man’s being, but is so comprehensive as to reach out to every condition and circumstance of his life.',
      'A man is literally what he thinks, his character being the complete sum of all his thoughts.',
      'As the plant springs from, and could not be without, the seed, so every act of a man springs from the hidden seeds of thought, and could not have appeared without them.',
      'Act is the blossom of thought, and joy and suffering are its fruits; thus does a man garner in the sweet and bitter fruitage of his own husbandry.',
      'Man is made or unmade by himself; in the armory of thought he forges the weapons by which he destroys himself; he also fashions the tools with which he builds for himself heavenly mansions of joy and strength and peace.',
    ],
  },
  {
    id: 'think-ch2',
    title: 'Page 2: Effect of Thought on Circumstances',
    readingTimeMinutes: 5,
    content: [
      'A man’s mind may be likened to a garden, which may be intelligently cultivated or allowed to run wild; but whether cultivated or neglected, it must, and will, bring forth.',
      'If no useful seeds are put into it, then an abundance of useless weed seeds will fall therein, and will continue to produce their kind.',
      'Just as a gardener cultivates his plot, keeping it free from weeds, and growing the flowers and fruits which he requires, so may a man tend the garden of his mind, weeding out all the impure, useless, and wrong thoughts, and cultivating toward perfection the flowers and fruits of right, useful, and pure thoughts.',
      'Circumstance does not make the man; it reveals him to himself.',
    ],
  },
  {
    id: 'think-ch3',
    title: 'Page 3: Thought and Purpose',
    readingTimeMinutes: 5,
    content: [
      'Until thought is linked with purpose there is no intelligent accomplishment. With the majority the bark of thought is allowed to drift upon the ocean of life. Aimlessness is a vice, and such drifting must not continue for him who would steer clear of catastrophe and destruction.',
      'They who have no central purpose in their life fall an easy prey to petty worries, fears, troubles, and self-pityings, all of which are indications of weakness, which lead, just as surely as deliberately planned sins, to failure, unhappiness, and loss.',
      'A man should conceive of a legitimate purpose in his heart, and set out to accomplish it. He should make this purpose the centralizing point of his thoughts.',
      'He should make this purpose his supreme duty, and should devote himself to its attainment, not allowing his thoughts to wander away into ephemeral fancies, longings, and imaginings.',
    ],
  },
  {
    id: 'think-ch4',
    title: 'Page 4: Visions, Ideals and Serenity',
    readingTimeMinutes: 5,
    content: [
      'The dreamers are the saviors of the world. As the visible world is sustained by the invisible, so men, through all their trials and sins and sordid vocations, are nourished by the beautiful visions of their solitary dreamers.',
      'Cherish your visions; cherish your ideals; cherish the music that stirs in your heart, the beauty that forms in your mind, the loveliness that drapes your purest thoughts, for out of them will grow all delightful conditions, all heavenly environment.',
      'Calmness of mind is one of the beautiful jewels of wisdom. It is the result of long and patient effort in self-control. Its presence is an indication of matured experience, and of an extraordinary knowledge of the laws and operations of thought.',
      'How beautiful is serenity! What a lovely life that lives by the still waters, on the tranquil heights of character!',
    ],
  },
];

export const INITIAL_BOOKS: Book[] = [
  // 1. Featured PDF Book: Bitcoin Whitepaper (Complete 9 Pages)
  createPdfBook(
    'pdf-bitcoin-whitepaper',
    'Bitcoin: A Peer-to-Peer Electronic Cash System',
    'The Original Cryptographic & Sovereign Money Whitepaper',
    'Satoshi Nakamoto',
    'bitcoin.pdf',
    '184 KB',
    'from-amber-950 via-orange-950 to-yellow-950',
    '#f59e0b',
    9,
    'The historic foundational document of decentralized cryptographic consensus, proof-of-work, and sovereign digital assets. Rendered in original 9-page PDF layout and Apple Books flow.',
    BITCOIN_CHAPTERS
  ),

  // 2. Featured PDF Book: Attention Is All You Need (Transformers - Complete 10 Pages)
  createPdfBook(
    'pdf-attention-transformer',
    'Attention Is All You Need: Transformer Foundations',
    'The Architectural Genesis of Modern Large Language Models',
    'Ashish Vaswani, Noam Shazeer et al. (Google Brain)',
    'attention-is-all-you-need.pdf',
    '2.1 MB',
    'from-blue-950 via-indigo-950 to-cyan-950',
    '#0ea5e9',
    10,
    'The seminal paper that introduced the Transformer architecture, multi-head self-attention, and sparked the modern AI revolution. Full PDF whitepaper layout and readable notes.',
    ATTENTION_CHAPTERS
  ),

  // 3. Featured PDF Book: The Sovereign Individual (4 Pages)
  createPdfBook(
    'pdf-sovereign-individual',
    'The Sovereign Individual: Megapolitics & Autonomous Capital',
    'Mastering the Transition to the Cyberspace Information Age',
    'James Dale Davidson & Lord William Rees-Mogg',
    'sovereign-individual.pdf',
    '1.4 MB',
    'from-slate-950 via-zinc-900 to-emerald-950',
    '#10b981',
    4,
    'Executive treatise predicting microprocessing, sovereign cyber-currencies, the breakdown of nation-state monopolies, and how sovereign families architect resilient wealth.',
    SOVEREIGN_CHAPTERS
  ),

  // 4. Featured PDF Book: As a Man Thinketh (4 Pages)
  createPdfBook(
    'pdf-as-a-man-thinketh',
    'As a Man Thinketh & Sovereign Mindset',
    'Thought, Character, Mental Gardens, and Supreme Purpose',
    'James Allen',
    'as-a-man-thinketh.pdf',
    '620 KB',
    'from-purple-950 via-slate-950 to-indigo-950',
    '#a855f7',
    4,
    'The quintessential philosophical treatise on cultivating the mental garden, directing character towards high leverage, and mastering inner composure.',
    AS_A_MAN_THINKETH_CHAPTERS
  ),

  // 5. Classic Curated Books
  {
    id: 'steve-jobs-innovators-compass',
    title: "The Innovator's Compass",
    subtitle: 'Focus, Taste, and the Relentless Pursuit of Simplicity',
    author: 'Thamiz (Curated Synthesis)',
    genre: 'Venture & Tech',
    coverGradient: 'from-zinc-900 via-neutral-800 to-amber-950',
    accentColor: '#f59e0b',
    rating: 4.95,
    reviewCount: 328,
    totalPages: 3,
    currentPage: 1,
    currentChapterId: 'ch1',
    progressPercent: 33,
    isFavorite: true,
    isAudiobook: true,
    audioDurationMinutes: 185,
    addedAt: '2026-03-01',
    lastReadAt: '2026-10-14T07:30:00Z',
    description:
      'An executive codification of Steve Jobs’ product philosophies: why saying no to 1,000 good ideas enables one singular masterpiece, the intersection of liberal arts and silicon, and cultivating an unbending taste standard.',
    chapters: [
      {
        id: 'ch1',
        title: 'Chapter 1: The Courage to Say No to 1,000 Things',
        readingTimeMinutes: 7,
        content: [
          'People think focus means saying yes to the thing you’ve got to focus on. But that’s not what it means at all. It means saying no to the hundred other good ideas that there are. You have to pick carefully.',
          'When Steve Jobs returned to Apple in 1997, he found an organization suffocating under dozens of fractured product variants. There were multiple Macintoshes, printers, scanners, and peripherals. During a marathon strategic review, he famously walked up to the whiteboard, drew a simple 2x2 grid, and declared: "Consumer, Professional, Desktop, Portable." Everything else was eliminated.',
          'Simplicity is not the absence of clutter; it is the ultimate expression of resolve. True focus requires an emotional tolerance for disappointing people who bring you merely "good" ideas, so that the truly extraordinary breakthrough can claim 100% of your energy.',
          'In building sovereign family wealth, venture scaling, and personal tools, this principle is absolute. You do not win by doing twenty speculative ventures simultaneously. You win by identifying the single leverage point where your unique insight is unmatched, and pouring unconditional craftsmanship into it.',
        ],
      },
      {
        id: 'ch2',
        title: 'Chapter 2: The Marriage of Silicon and Liberal Arts',
        readingTimeMinutes: 9,
        content: [
          'It is in Apple’s DNA that technology alone is not enough. It’s technology married with liberal arts, married with the humanities, that yields us the result that makes our heart sing.',
          'Engineering without aesthetic empathy produces machinery that feels cold, utilitarian, and disposable. When typography, proportional harmony, tactile responsiveness, and human psychology are treated as first-class citizens alongside compiler optimization, software transforms from an instrument into an extension of the human mind.',
        ],
      },
      {
        id: 'ch3',
        title: 'Chapter 3: Reality Distortion as Sovereign Will',
        readingTimeMinutes: 8,
        content: [
          'The phrase "Reality Distortion Field" was coined by Bud Tribble to describe Steve Jobs’ ability to convince himself and everyone around him that an impossible deadline or a radically thin chassis was achievable within weeks.',
          'In reality, the field was an uncompromising rejection of default assumptions. Most humans operate under inherited constraints. When you refuse to accept conventional limits, you force engineers and creators to discard incremental thinking.',
        ],
      },
    ],
  },
  {
    id: 'maarans-robotics-ai-lab',
    title: "Maaran's Robotics & AI Lab",
    subtitle: 'From Micro-Satellites to Autonomous Martian Rovers',
    author: 'Thamiz & Maaran (Aura STEM Lab)',
    genre: 'Robotics & STEM',
    coverGradient: 'from-violet-950 via-indigo-900 to-cyan-950',
    accentColor: '#8b5cf6',
    rating: 5.0,
    reviewCount: 42,
    totalPages: 2,
    currentPage: 1,
    currentChapterId: 'ch1',
    progressPercent: 50,
    isFavorite: true,
    isAudiobook: false,
    audioDurationMinutes: 120,
    addedAt: '2026-03-10',
    lastReadAt: '2026-10-14T01:00:00Z',
    description:
      'An inspiring handbook dedicated to young Maaran’s robotics curiosity: exploring LiDAR SLAM pathfinding, brushless motor torque matrices, computer vision neural nets, and building autonomous lunar explorers.',
    chapters: [
      {
        id: 'ch1',
        title: 'Chapter 1: The Anatomy of an Autonomous Rover',
        readingTimeMinutes: 6,
        content: [
          'Welcome to the Aura STEM Robotics Laboratory! To build a rover that can traverse unpredictable terrain—whether the red dust of Mars or the living room carpet—we need four fundamental organ systems: Structure, Actuation, Perception, and Cognition.',
          '1. Structure: The Rocker-Bogie suspension system. Unlike a standard car chassis that tilts violently when a wheel climbs a rock, the rocker-bogie mechanism uses a differential gearbox that keeps all six wheels firmly in contact with the ground.',
          '2. Actuation: High-torque brushless DC motors paired with planetary gearboxes and magnetic encoders.',
        ],
      },
      {
        id: 'ch2',
        title: 'Chapter 2: Sensor Fusion & LiDAR SLAM',
        readingTimeMinutes: 7,
        content: [
          'How does a robot know where it is when GPS is completely unavailable? The answer is SLAM: Simultaneous Localization and Mapping.',
          'We use the Extended Kalman Filter (EKF) to fuse noisy data from wheel encoders, gyroscopes, and laser reflections. When noise is filtered, pure geometric truth emerges!',
        ],
      },
    ],
  },
  {
    id: 'marcus-aurelius-meditations',
    title: 'Meditations: The Emperor’s Journal',
    subtitle: 'Stoic Self-Governance and Unshakable Fortitude',
    author: 'Marcus Aurelius',
    genre: 'Philosophy & Classics',
    coverGradient: 'from-amber-950 via-stone-900 to-amber-900',
    accentColor: '#d97706',
    rating: 4.96,
    reviewCount: 1540,
    totalPages: 2,
    currentPage: 2,
    currentChapterId: 'ch2',
    progressPercent: 100,
    isFinished: true,
    isFavorite: true,
    isAudiobook: true,
    audioDurationMinutes: 140,
    addedAt: '2026-01-10',
    lastReadAt: '2026-10-10T14:20:00Z',
    description:
      'Private reminders penned by Roman Emperor Marcus Aurelius on the Danube frontier: master your mind, view external crises with detachment, perform your duty without complaint, and remain humble amid imperial power.',
    chapters: [
      {
        id: 'ch1',
        title: 'Book II: Reminders at Dawn',
        readingTimeMinutes: 7,
        content: [
          'When you wake up in the morning, tell yourself: The people I deal with today will be meddling, ungrateful, arrogant, dishonest, jealous, and surly. They are like this because they cannot distinguish good from evil.',
          'None of them can hurt me. No one can implicate me in ugliness. Nor can I feel angry at my kin, or hate him. We were made to work together like hands, like feet, like the rows of the upper and lower teeth. To obstruct each other is contrary to nature.',
        ],
      },
      {
        id: 'ch2',
        title: 'Book IV: The Inner Citadel',
        readingTimeMinutes: 8,
        content: [
          'People look for retreats for themselves, in the country, by the coast, or in the hills. There is nowhere that a person can find a more peaceful and trouble-free retreat than in his own mind.',
          'Remember: The universe is change; life is opinion. What upsets people is not things themselves, but their judgments about the things.',
        ],
      },
    ],
  },
  {
    id: 'tamil-merchant-kings',
    title: 'The Tamil Merchant Kings & Maritime Empires',
    subtitle: 'Naval Dominance, Trans-Oceanic Escrow & Dynasty Capital',
    author: 'Classical Historical Archive & Heritage Guild',
    genre: 'Dynasty & History',
    coverGradient: 'from-orange-950 via-rose-950 to-slate-900',
    accentColor: '#f97316',
    rating: 4.97,
    reviewCount: 198,
    totalPages: 2,
    currentPage: 1,
    currentChapterId: 'ch1',
    progressPercent: 50,
    isFavorite: false,
    isAudiobook: false,
    audioDurationMinutes: 210,
    addedAt: '2026-03-20',
    lastReadAt: '2026-10-12T16:00:00Z',
    description:
      'How the Chola and Pandyan merchant guilds (Ainnurruvar & Manigramam) dominated trans-oceanic spice, silk, and bullion trade from Rome to Canton through sovereign contracts, naval escort armadas, and multi-generational trusts.',
    chapters: [
      {
        id: 'ch1',
        title: 'Chapter 1: The Ainnurruvar: 500 Lords of the Trade Guilds',
        readingTimeMinutes: 9,
        content: [
          'A millennium before the Dutch East India Company or Wall Street consortiums, the southern coast of Tamilakam gave birth to sovereign merchant republics known as the Ayyavole 500 (Ainnurruvar) and Manigramam.',
          'These were not humble traders; they possessed their own sovereign naval armadas, their own mercenary corps (Banañju-dharma), and minted their own bilingual currency bearing the symbol of the tiger, fish, and bow.',
        ],
      },
      {
        id: 'ch2',
        title: 'Chapter 2: Maritime Escrow & Trans-Oceanic Trust',
        readingTimeMinutes: 8,
        content: [
          'Their copper-plate inscriptions found in Sumatra, Malaysia, and southern China demonstrate an extraordinary understanding of multi-jurisdictional risk mitigation, escrow guarantees, and maritime insurance.',
          'An oath sworn by a Tamil merchant guild was honored across 5,000 nautical miles without exception.',
        ],
      },
    ],
  },
  {
    id: 'atomic-habits-behavioral-architecture',
    title: 'Atomic Habits & Behavioral Architecture',
    subtitle: 'Compounding Micro-Disciplines for Sovereign Mastery',
    author: 'James Clear Synthesis & Executive Notes',
    genre: 'Behavior & Habits',
    coverGradient: 'from-emerald-950 via-teal-950 to-slate-950',
    accentColor: '#14b8a6',
    rating: 4.94,
    reviewCount: 920,
    totalPages: 2,
    currentPage: 1,
    currentChapterId: 'ch1',
    progressPercent: 50,
    isFavorite: true,
    isAudiobook: true,
    audioDurationMinutes: 175,
    addedAt: '2026-02-01',
    lastReadAt: '2026-10-14T06:15:00Z',
    description:
      'Mastering the 1% compound effect: why goals are overrated compared to systems, environment design over willpower, and how small behavioral nudges compound into extraordinary sovereign capability.',
    chapters: [
      {
        id: 'ch1',
        title: 'Chapter 1: The Surprising Power of Atomic Habits',
        readingTimeMinutes: 7,
        content: [
          'If you can get 1 percent better each day for one year, you’ll end up thirty-seven times better by the time you’re done. Conversely, if you get 1 percent worse each day for one year, you’ll decline nearly down to zero.',
          'You do not rise to the level of your goals. You fall to the level of your systems.',
        ],
      },
      {
        id: 'ch2',
        title: 'Chapter 2: Identity-Based Habit Loops',
        readingTimeMinutes: 6,
        content: [
          'True behavior change is identity change. The goal is not to read a book, the goal is to become a reader.',
          'Every action you take is a vote for the type of person you wish to become. No single instance will transform your beliefs, but as the votes build up, so does the evidence of your new identity.',
        ],
      },
    ],
  },
  {
    id: 'sun-tzu-art-of-war-modern',
    title: 'The Art of War: 21st Century Strategy',
    subtitle: 'Asymmetric Leverage, Information Dominance & Peace',
    author: 'Sun Tzu & Modern Strategy Guild',
    genre: 'Philosophy & Classics',
    coverGradient: 'from-red-950 via-slate-900 to-amber-950',
    accentColor: '#ef4444',
    rating: 4.92,
    reviewCount: 460,
    totalPages: 2,
    currentPage: 1,
    currentChapterId: 'ch1',
    progressPercent: 50,
    wantToRead: true,
    isAudiobook: true,
    audioDurationMinutes: 110,
    addedAt: '2026-03-25',
    description:
      'The timeless treatise on strategic asymmetry: winning without battle, deceptive positioning, timing, psychological composure, and managing high-stakes technology alliances.',
    chapters: [
      {
        id: 'ch1',
        title: 'Chapter 1: Estimates and Strategic Foundation',
        readingTimeMinutes: 6,
        content: [
          'The art of war is of vital importance to the State. It is a matter of life and death, a road either to safety or to ruin.',
          'All warfare is based on deception. Hence, when able to attack, we must seem unable; when using our forces, we must seem inactive.',
          'The supreme art of war is to subdue the enemy without fighting.',
        ],
      },
      {
        id: 'ch2',
        title: 'Chapter 2: Waging Asymmetric Campaigns',
        readingTimeMinutes: 7,
        content: [
          'In war, the best policy is to take a state intact; to ruin it is inferior.',
          'He will win who knows when to fight and when not to fight. He will win who knows how to handle both superior and inferior forces.',
        ],
      },
    ],
  },
];
