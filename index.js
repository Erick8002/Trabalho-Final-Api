const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const PORT = 8000;

app.use(express.json());
app.set('json spaces', 2);

let db;

// 1. Configuração do Banco de Dados
async function setupDatabase() {
    db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS filmes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            diretor TEXT NOT NULL,
            ano INTEGER NOT NULL,
            genero TEXT NOT NULL,
            nota REAL NOT NULL
        )
    `);

    const count = await db.get("SELECT COUNT(*) as total FROM filmes");
    
    if (count.total === 0) {
        await db.exec(`
            INSERT INTO filmes (id, titulo, diretor, ano, genero, nota) VALUES
            (1, 'O Poderoso Chefão', 'Francis Ford Coppola', 1972, 'Crime', 9.2),
            (2, 'Batman: O Cavaleiro das Trevas', 'Christopher Nolan', 2008, 'Ação', 9.0),
            (3, 'A Lista de Schindler', 'Steven Spielberg', 1993, 'Biografia', 9.0),
            (4, 'Pulp Fiction', 'Quentin Tarantino', 1994, 'Crime', 8.9),
            (5, 'O Senhor dos Anéis: O Retorno do Rei', 'Peter Jackson', 2003, 'Aventura', 9.0),
            (6, 'Clube da Luta', 'David Fincher', 1999, 'Drama', 8.8),
            (7, 'A Origem', 'Christopher Nolan', 2010, 'Ficção Científica', 8.8),
            (8, 'Matrix', 'Lana e Lilly Wachowski', 1999, 'Ficção Científica', 8.7),
            (9, 'Interestelar', 'Christopher Nolan', 2014, 'Ficção Científica', 8.7),
            (10, 'Cidade de Deus', 'Fernando Meirelles', 2002, 'Crime', 8.6),
            (11, 'O Silêncio dos Inocentes', 'Jonathan Demme', 1991, 'Suspense', 8.6),
            (12, 'Seven: Os Sete Crimes Capitais', 'David Fincher', 1995, 'Policial', 8.6),
            (13, 'A Viagem de Chihiro', 'Hayao Miyazaki', 2001, 'Animação', 8.6),
            (14, 'O Rei Leão', 'Roger Allers', 1994, 'Animação', 8.5),
            (15, 'Gladiador', 'Ridley Scott', 2000, 'Ação', 8.5),
            (16, 'Parasita', 'Bong Joon-ho', 2019, 'Drama', 8.5),
            (17, 'Whiplash: Em Busca da Perfeição', 'Damien Chazelle', 2014, 'Drama', 8.5),
            (18, 'O Grande Truque', 'Christopher Nolan', 2006, 'Mistério', 8.5),
            (19, 'Coringa', 'Todd Phillips', 2019, 'Drama', 8.4),
            (20, 'Vingadores: Ultimato', 'Anthony e Joe Russo', 2019, 'Ação', 8.4)
        `);
        console.log("✅ Banco de dados com 20 registros (IDs 1-20)!");
    }
}

// --- ROTAS ---

// GET /filmes - Listagem com Filtros e Paginação
app.get('/filmes', async (req, res) => {
    try {
        let { pagina = 1, limite = 10, genero, ordem = 'asc' } = req.query;
        const offset = (Math.max(1, pagina) - 1) * limite;
        
        let sql = "SELECT * FROM filmes WHERE 1=1";
        let params = [];

        if (genero) {
            sql += " AND genero = ?";
            params.push(genero);
        }

        const direcao = ordem.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
        sql += ` ORDER BY id ${direcao} LIMIT ? OFFSET ?`;
        params.push(parseInt(limite), parseInt(offset));

        const rows = await db.all(sql, params);
        const countResult = await db.get("SELECT COUNT(*) as count FROM filmes");

        res.json({
            dados: rows,
            paginacao: {
                pagina_atual: parseInt(pagina),
                total_itens: countResult.count,
                total_paginas: Math.ceil(countResult.count / limite)
            }
        });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar filmes" });
    }
});

// GET /filmes/:id - Buscar por ID
app.get('/filmes/:id', async (req, res) => {
    const filme = await db.get("SELECT * FROM filmes WHERE id = ?", [req.params.id]);
    if (filme) {
        res.json(filme);
    } else {
        res.status(404).json({ erro: "Filme não encontrado" });
    }
});

// POST /filmes - Adicionar novo filme
app.post('/filmes', async (req, res) => {
    const { titulo, diretor, ano, genero, nota } = req.body;

    if (!titulo || !diretor || !ano || !genero || !nota) {
        return res.status(400).json({ erro: "Todos os campos são obrigatórios!" });
    }
    if (typeof ano !== 'number' || typeof nota !== 'number') {
        return res.status(400).json({ erro: "Ano e Nota devem ser números!" });
    }

    try {
        const result = await db.run(
            "INSERT INTO filmes (titulo, diretor, ano, genero, nota) VALUES (?, ?, ?, ?, ?)",
            [titulo, diretor, ano, genero, nota]
        );
        res.status(201).json({ id: result.lastID, titulo, diretor, ano, genero, nota });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao inserir filme" });
    }
});

// PUT /filmes/:id - Atualizar filme
app.put('/filmes/:id', async (req, res) => {
    const id = req.params.id;
    const { titulo, diretor, ano, genero, nota } = req.body;

    if (!titulo || !diretor || !ano || !genero || !nota) {
        return res.status(400).json({ erro: "Todos os campos são obrigatórios!" });
    }

    const result = await db.run(
        "UPDATE filmes SET titulo = ?, diretor = ?, ano = ?, genero = ?, nota = ? WHERE id = ?",
        [titulo, diretor, ano, genero, nota, id]
    );

    if (result.changes === 0) {
        return res.status(404).json({ erro: "Filme não encontrado" });
    }
    res.json({ id: parseInt(id), titulo, diretor, ano, genero, nota });
});

// DELETE /filmes/:id - Remover filme
app.delete('/filmes/:id', async (req, res) => {
    const result = await db.run("DELETE FROM filmes WHERE id = ?", [req.params.id]);
    
    if (result.changes === 0) {
        return res.status(404).json({ erro: "Filme não encontrado" });
    }
    res.json({ mensagem: "Filme removido com sucesso!" });
});

// 3. Função Principal de Inicialização
async function iniciarServidor() {
    try {
        await setupDatabase(); 
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
            console.log("👉 Mantenha este terminal aberto para usar o Postman");
        });
    } catch (erro) {
        console.error("❌ Falha ao iniciar o servidor:", erro);
    }
}

iniciarServidor();